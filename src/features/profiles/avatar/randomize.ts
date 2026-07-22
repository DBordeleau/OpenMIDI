import {
  AVATAR_EYEBROW_VARIANTS,
  AVATAR_EYE_VARIANTS,
  AVATAR_GLASSES_VARIANTS,
  AVATAR_MOUTH_VARIANTS,
  AVATAR_TONE_PALETTE,
  type AvatarOptionsV1,
} from "./contract";

export type AvatarRandomSource = () => number;

function pick<T>(values: readonly T[], random: AvatarRandomSource): T {
  const sample = random();
  const safeSample = Number.isFinite(sample)
    ? Math.min(Math.max(sample, 0), 1 - Number.EPSILON)
    : 0;
  return values[Math.floor(safeSample * values.length)];
}

export function randomizeAvatarOptions(
  random: AvatarRandomSource = Math.random,
): AvatarOptionsV1 {
  const options = {
    eyebrowsVariant: pick(AVATAR_EYEBROW_VARIANTS, random),
    eyesVariant: pick(AVATAR_EYE_VARIANTS, random),
    glassesVariant: pick(AVATAR_GLASSES_VARIANTS, random),
    glassesProbability: random() < 0.5 ? 0 : 100,
    mouthVariant: pick(AVATAR_MOUTH_VARIANTS, random),
    backgroundColor: pick(AVATAR_TONE_PALETTE, random),
  } as const;
  const scaleStep = Math.floor(
    Math.min(Math.max(random(), 0), 1 - Number.EPSILON) * 17,
  );
  const rotationStep = Math.floor(
    Math.min(Math.max(random(), 0), 1 - Number.EPSILON) * 41,
  );

  return {
    ...options,
    scale: Math.round((0.8 + scaleStep * 0.05) * 100) / 100,
    rotate: -20 + rotationStep,
  };
}
