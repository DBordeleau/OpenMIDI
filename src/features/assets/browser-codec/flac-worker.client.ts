/// <reference lib="webworker" />

import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  ConversionCanceledError,
  FlacOutputFormat,
  Input,
  Output,
  type AudioSample,
} from "mediabunny";
import { registerFlacEncoder } from "@mediabunny/flac-encoder";
import {
  PEAK_BIN_COUNT,
  type LosslessAudioMetadata,
  type WorkerResponse,
} from "./contract";

registerFlacEncoder();

let activeConversion: Conversion | null = null;

self.onmessage = async (
  event: MessageEvent<
    { type: "cancel" } | { type: "start"; bytes: ArrayBuffer }
  >,
) => {
  if (event.data.type === "cancel") {
    await activeConversion?.cancel();
    return;
  }

  try {
    const sourceBlob = new Blob([event.data.bytes], { type: "audio/wav" });
    const input = new Input({
      source: new BlobSource(sourceBlob),
      formats: ALL_FORMATS,
    });
    const sourceTrack = await input.getPrimaryAudioTrack();
    if (!sourceTrack) throw new Error("The selected WAV has no audio track.");
    const sourceMetadata: LosslessAudioMetadata = {
      durationSeconds: await input.computeDuration(),
      channels: await sourceTrack.getNumberOfChannels(),
      sampleRate: await sourceTrack.getSampleRate(),
    };
    const peaks = new PeakAccumulator(sourceMetadata, PEAK_BIN_COUNT);
    const target = new BufferTarget();
    const output = new Output({ format: new FlacOutputFormat(), target });
    const conversion = await Conversion.init({
      input,
      output,
      audio: {
        forceTranscode: true,
        process: (sample) => {
          peaks.add(sample);
          return sample;
        },
      },
    });
    activeConversion = conversion;
    conversion.onProgress = (progress) => post({ type: "progress", progress });
    const startedAt = performance.now();
    await conversion.execute();
    const conversionMilliseconds = performance.now() - startedAt;
    activeConversion = null;

    const bytes = target.buffer;
    if (!bytes) throw new Error("The FLAC encoder returned no bytes.");
    const verificationInput = new Input({
      source: new BlobSource(new Blob([bytes], { type: "audio/flac" })),
      formats: ALL_FORMATS,
    });
    const verificationTrack = await verificationInput.getPrimaryAudioTrack();
    if (!verificationTrack)
      throw new Error("The optimized FLAC has no audio track.");
    const metadata: LosslessAudioMetadata = {
      durationSeconds: await verificationInput.computeDuration(),
      channels: await verificationTrack.getNumberOfChannels(),
      sampleRate: await verificationTrack.getSampleRate(),
    };
    const peakValues = peaks.finish();
    const peakBuffer = peakValues.buffer as ArrayBuffer;
    post(
      {
        type: "done",
        bytes,
        metadata,
        sourceMetadata,
        peaks: peakBuffer,
        peakBins: PEAK_BIN_COUNT,
        conversionMilliseconds,
      },
      [bytes, peakBuffer],
    );
  } catch (error) {
    activeConversion = null;
    if (error instanceof ConversionCanceledError) {
      post({ type: "cancelled" });
      return;
    }
    const memoryFailure =
      error instanceof RangeError ||
      (error instanceof Error && /memory|allocation/i.test(error.message));
    post({
      type: "error",
      code: memoryFailure ? "memory_limit" : "conversion_failed",
      message: memoryFailure
        ? "This device ran out of memory during lossless conversion. Upload the original WAV instead."
        : error instanceof Error
          ? error.message
          : "Lossless conversion failed.",
    });
  }
};

class PeakAccumulator {
  private readonly values: Float32Array;
  private readonly totalFrames: number;

  constructor(
    private readonly metadata: LosslessAudioMetadata,
    private readonly bins: number,
  ) {
    this.totalFrames = Math.max(
      1,
      Math.ceil(metadata.durationSeconds * metadata.sampleRate),
    );
    this.values = new Float32Array(metadata.channels * bins * 2);
    for (let index = 0; index < this.values.length; index += 2) {
      this.values[index] = 1;
      this.values[index + 1] = -1;
    }
  }

  add(sample: AudioSample) {
    const startFrame = Math.max(
      0,
      Math.round(sample.timestamp * this.metadata.sampleRate),
    );
    for (let channel = 0; channel < this.metadata.channels; channel += 1) {
      const channelData = new Float32Array(sample.numberOfFrames);
      sample.copyTo(channelData, {
        planeIndex: channel,
        format: "f32-planar",
      });
      for (let frame = 0; frame < channelData.length; frame += 1) {
        const bin = Math.min(
          this.bins - 1,
          Math.floor(((startFrame + frame) / this.totalFrames) * this.bins),
        );
        const offset = (channel * this.bins + bin) * 2;
        const value = Math.max(-1, Math.min(1, channelData[frame] ?? 0));
        this.values[offset] = Math.min(this.values[offset] ?? 1, value);
        this.values[offset + 1] = Math.max(
          this.values[offset + 1] ?? -1,
          value,
        );
      }
    }
  }

  finish() {
    for (let index = 0; index < this.values.length; index += 2) {
      if (this.values[index] > this.values[index + 1]) {
        this.values[index] = 0;
        this.values[index + 1] = 0;
      }
    }
    return this.values;
  }
}

function post(message: WorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(message, { transfer });
}

export {};
