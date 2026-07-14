export type WebMidiCapability =
  | { supported: true; reason: null }
  | { supported: false; reason: "insecure_context" | "unavailable" };

export function detectWebMidiCapability(input: {
  secureContext: boolean;
  requestMidiAccess: unknown;
}): WebMidiCapability {
  if (!input.secureContext)
    return { supported: false, reason: "insecure_context" };
  if (typeof input.requestMidiAccess !== "function") {
    return { supported: false, reason: "unavailable" };
  }
  return { supported: true, reason: null };
}
