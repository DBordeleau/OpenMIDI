import {
  LOSSLESS_CONVERSION_VERSION,
  PEAKS_VERSION,
  optimizedFilename,
  validateLosslessResult,
  type LosslessOptimizationResult,
  type WorkerResponse,
} from "./contract";
import { getCodecCapability } from "./capability";

export { getCodecCapability };

export async function optimizeWavLosslessly(
  file: File,
  options: {
    signal: AbortSignal;
    onProgress: (progress: number) => void;
  },
): Promise<LosslessOptimizationResult> {
  const capability = getCodecCapability();
  if (!capability.supported) throw new Error(capability.reason);
  if (options.signal.aborted) throw abortError();

  const worker = new Worker(
    new URL("./flac-worker.client.ts", import.meta.url),
    {
      type: "module",
    },
  );
  const bytes = await file.arrayBuffer();
  if (options.signal.aborted) {
    worker.terminate();
    throw abortError();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      options.signal.removeEventListener("abort", abort);
      worker.terminate();
      callback();
    };
    const abort = () => {
      worker.postMessage({ type: "cancel" });
      finish(() => reject(abortError()));
    };
    options.signal.addEventListener("abort", abort, { once: true });
    worker.onerror = (event) =>
      finish(() =>
        reject(
          new Error(
            event.message || "The browser lossless encoder could not start.",
          ),
        ),
      );
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type === "progress") {
        options.onProgress(Math.max(0, Math.min(1, data.progress)));
        return;
      }
      if (data.type === "cancelled") {
        finish(() => reject(abortError()));
        return;
      }
      if (data.type === "error") {
        finish(() => reject(new Error(data.message)));
        return;
      }
      try {
        const values = validateLosslessResult(data);
        const optimized = new File([data.bytes], optimizedFilename(file.name), {
          type: "audio/flac",
          lastModified: file.lastModified,
        });
        finish(() =>
          resolve({
            file: optimized,
            metadata: data.metadata,
            peaks: {
              version: PEAKS_VERSION,
              bins: data.peakBins,
              channels: data.metadata.channels,
              values,
            },
            conversionVersion: LOSSLESS_CONVERSION_VERSION,
          }),
        );
      } catch (error) {
        finish(() => reject(error));
      }
    };
    worker.postMessage({ type: "start", bytes }, [bytes]);
  });
}

function abortError() {
  return new DOMException("Lossless conversion cancelled.", "AbortError");
}
