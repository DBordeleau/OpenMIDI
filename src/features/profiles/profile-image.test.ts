import { describe, expect, it } from "vitest";
import {
  edgeCorsHeaders,
  edgeCorsPreflightResponse,
} from "../../../supabase/functions/_shared/cors";
import {
  detectProfileImageSignature,
  PermanentProfileImageError,
  validateProfileImageMetadata,
} from "../../../supabase/functions/_shared/profile-image";

describe("profile image validation", () => {
  it("permits browser preflight before avatar processing", async () => {
    const response = edgeCorsPreflightResponse();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "POST, OPTIONS",
    );
    expect(edgeCorsHeaders["Access-Control-Allow-Headers"]).toContain(
      "authorization",
    );
  });

  it("detects the supported signatures", () => {
    expect(
      detectProfileImageSignature(Uint8Array.from([0xff, 0xd8, 0xff])),
    ).toBe("image/jpeg");
    expect(
      detectProfileImageSignature(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
    expect(
      detectProfileImageSignature(new TextEncoder().encode("RIFF0000WEBP")),
    ).toBe("image/webp");
  });

  it("rejects MIME disagreement, oversized dimensions, and animation", () => {
    for (const input of [
      {
        signatureMediaType: "image/png" as const,
        declaredMediaType: "image/jpeg",
        width: 512,
        height: 512,
        frameCount: 1,
      },
      {
        signatureMediaType: "image/png" as const,
        declaredMediaType: "image/png",
        width: 5000,
        height: 512,
        frameCount: 1,
      },
      {
        signatureMediaType: "image/webp" as const,
        declaredMediaType: "image/webp",
        width: 512,
        height: 512,
        frameCount: 2,
      },
    ])
      expect(() => validateProfileImageMetadata(input)).toThrow(
        PermanentProfileImageError,
      );
  });
});
