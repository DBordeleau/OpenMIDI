import { describe, expect, it } from "vitest";
import { evaluateCodecCapability } from "./capability";
import {
  PEAK_BIN_COUNT,
  optimizedFilename,
  validateLosslessResult,
  type WorkerDoneMessage,
} from "./contract";

function validMessage(): WorkerDoneMessage {
  const peaks = new Float32Array(PEAK_BIN_COUNT * 2);
  return {
    type: "done",
    bytes: new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0]).buffer,
    metadata: { durationSeconds: 2, channels: 1, sampleRate: 44_100 },
    sourceMetadata: {
      durationSeconds: 2,
      channels: 1,
      sampleRate: 44_100,
    },
    peaks: peaks.buffer,
    peakBins: PEAK_BIN_COUNT,
    conversionMilliseconds: 10,
  };
}

describe("browser lossless codec contract", () => {
  it("accepts a bounded FLAC with matching metadata and normalized peaks", () => {
    expect(validateLosslessResult(validMessage())).toHaveLength(
      PEAK_BIN_COUNT * 2,
    );
    expect(optimizedFilename("Studio Take.WAV")).toBe("Studio Take.flac");
  });

  it("rejects signature, metadata, and peak mismatches", () => {
    const signature = validMessage();
    signature.bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    expect(() => validateLosslessResult(signature)).toThrow("signature");

    const metadata = validMessage();
    metadata.metadata.channels = 2;
    expect(() => validateLosslessResult(metadata)).toThrow("did not match");

    const peaks = validMessage();
    peaks.peaks = new Float32Array([2]).buffer;
    expect(() => validateLosslessResult(peaks)).toThrow("waveform");
  });

  it("falls back when worker, WASM, or reported device memory is insufficient", () => {
    expect(
      evaluateCodecCapability({ worker: true, webAssembly: true }),
    ).toEqual({ supported: true, reason: null });
    expect(
      evaluateCodecCapability({ worker: false, webAssembly: true }).supported,
    ).toBe(false);
    expect(
      evaluateCodecCapability({
        worker: true,
        webAssembly: true,
        deviceMemoryGiB: 2,
      }).supported,
    ).toBe(false);
  });
});
