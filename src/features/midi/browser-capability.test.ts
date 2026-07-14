import { describe, expect, it, vi } from "vitest";
import { detectWebMidiCapability } from "./browser-capability";

describe("optional Web MIDI capability", () => {
  it("retains the manual path when the API is absent or the context is insecure", () => {
    expect(
      detectWebMidiCapability({
        secureContext: true,
        requestMidiAccess: undefined,
      }),
    ).toEqual({ supported: false, reason: "unavailable" });
    expect(
      detectWebMidiCapability({
        secureContext: false,
        requestMidiAccess: vi.fn(),
      }),
    ).toEqual({ supported: false, reason: "insecure_context" });
  });

  it("detects support without invoking the permission API", () => {
    const requestMidiAccess = vi.fn();
    expect(
      detectWebMidiCapability({ secureContext: true, requestMidiAccess }),
    ).toEqual({
      supported: true,
      reason: null,
    });
    expect(requestMidiAccess).not.toHaveBeenCalled();
  });
});
