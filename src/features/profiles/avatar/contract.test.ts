import { describe, expect, it } from "vitest";
import {
  avatarConfigFingerprint,
  AVATAR_EYEBROW_VARIANTS,
  AVATAR_EYE_VARIANTS,
  AVATAR_GLASSES_VARIANTS,
  AVATAR_MOUTH_VARIANTS,
  DEFAULT_AVATAR_OPTIONS,
  createAvatarConfig,
  normalizeAvatarColor,
  parseAvatarConfig,
} from "./contract";
import { randomizeAvatarOptions } from "./randomize";

const PROFILE_ID = "30000000-0000-4000-8000-000000000001";

describe("avatar configuration v1", () => {
  it("accepts only the canonical strict contract", () => {
    const config = createAvatarConfig(PROFILE_ID, DEFAULT_AVATAR_OPTIONS);
    expect(parseAvatarConfig(config)).toEqual(config);
    expect(parseAvatarConfig({ ...config, extra: true })).toBeNull();
    expect(parseAvatarConfig({ ...config, version: 2 })).toBeNull();
    expect(
      parseAvatarConfig({
        ...config,
        options: { ...DEFAULT_AVATAR_OPTIONS, backgroundColor: "#F2D3B1" },
      }),
    ).toBeNull();
    expect(
      parseAvatarConfig({
        ...config,
        options: { ...DEFAULT_AVATAR_OPTIONS, scale: 0.81 },
      }),
    ).toBeNull();
  });

  it("normalizes editor color input without weakening stored parsing", () => {
    expect(normalizeAvatarColor(" #F8E4F8 ")).toBe("f8e4f8");
  });

  it("creates a compact stable fingerprint without exposing the configuration", () => {
    const config = createAvatarConfig(PROFILE_ID, DEFAULT_AVATAR_OPTIONS);
    expect(config).not.toBeNull();
    if (!config) return;
    expect(avatarConfigFingerprint(config)).toMatch(/^avatar-v1-[0-9a-f]{8}$/);
    expect(avatarConfigFingerprint(config)).toBe(
      avatarConfigFingerprint(config),
    );
    expect(
      avatarConfigFingerprint({
        ...config,
        options: { ...config.options, rotate: 1 },
      }),
    ).not.toBe(avatarConfigFingerprint(config));
  });

  it("publishes the frozen catalog sizes and defaults", () => {
    expect(AVATAR_EYEBROW_VARIANTS).toHaveLength(15);
    expect(AVATAR_EYE_VARIANTS).toHaveLength(26);
    expect(AVATAR_GLASSES_VARIANTS).toHaveLength(5);
    expect(AVATAR_MOUTH_VARIANTS).toHaveLength(30);
    expect(DEFAULT_AVATAR_OPTIONS).toEqual({
      eyebrowsVariant: "variant01",
      eyesVariant: "variant01",
      glassesVariant: "variant01",
      glassesProbability: 0,
      mouthVariant: "variant01",
      backgroundColor: "f2d3b1",
      scale: 1,
      rotate: 0,
    });
  });
});

describe("avatar randomization", () => {
  it("is deterministic with an injected source and stays on valid steps", () => {
    const samples = [0, 0.999, 0.5, 0.49, 0.25, 0.75, 0.1, 0.9];
    let index = 0;
    const options = randomizeAvatarOptions(() => samples[index++]);

    expect(options).toEqual({
      eyebrowsVariant: "variant01",
      eyesVariant: "variant26",
      glassesVariant: "variant03",
      glassesProbability: 0,
      mouthVariant: "variant08",
      backgroundColor: "211414",
      scale: 0.85,
      rotate: 16,
    });
    expect(createAvatarConfig(PROFILE_ID, options)).not.toBeNull();
  });
});
