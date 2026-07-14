const LOW_MEMORY_GIB = 4;

export type CodecCapabilityInput = {
  worker: boolean;
  webAssembly: boolean;
  deviceMemoryGiB?: number;
};

export function evaluateCodecCapability(input: CodecCapabilityInput) {
  if (!input.worker || !input.webAssembly)
    return {
      supported: false as const,
      reason:
        "This browser cannot run the lossless encoder. You can upload the original WAV instead.",
    };
  if (
    input.deviceMemoryGiB !== undefined &&
    input.deviceMemoryGiB < LOW_MEMORY_GIB
  )
    return {
      supported: false as const,
      reason:
        "This device reports limited memory for lossless conversion. You can upload the original WAV instead.",
    };
  return { supported: true as const, reason: null };
}

export function getCodecCapability() {
  const navigatorWithMemory = navigator as Navigator & {
    deviceMemory?: number;
  };
  return evaluateCodecCapability({
    worker: typeof Worker === "function",
    webAssembly: typeof WebAssembly === "object",
    deviceMemoryGiB: navigatorWithMemory.deviceMemory,
  });
}
