import { describe, expect, it } from "vitest";
import { hasValidAvatarDimensions } from "./avatar-image";

describe("avatar image dimensions", () => {
  it("accepts the supported range and pixel budget", () => {
    expect(hasValidAvatarDimensions({ width: 128, height: 128 })).toBe(true);
    expect(hasValidAvatarDimensions({ width: 4096, height: 4096 })).toBe(true);
  });

  it("rejects undersized, oversized, and excessive images", () => {
    expect(hasValidAvatarDimensions({ width: 127, height: 512 })).toBe(false);
    expect(hasValidAvatarDimensions({ width: 4097, height: 512 })).toBe(false);
    expect(hasValidAvatarDimensions({ width: 4096, height: 4097 })).toBe(false);
  });
});
