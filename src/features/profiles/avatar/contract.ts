import { z } from "zod";

export const AVATAR_CONFIG_VERSION = 1 as const;

export const AVATAR_EYEBROW_VARIANTS = [
  "variant01",
  "variant02",
  "variant03",
  "variant04",
  "variant05",
  "variant06",
  "variant07",
  "variant08",
  "variant09",
  "variant10",
  "variant11",
  "variant12",
  "variant13",
  "variant14",
  "variant15",
] as const;

export const AVATAR_EYE_VARIANTS = [
  "variant01",
  "variant02",
  "variant03",
  "variant04",
  "variant05",
  "variant06",
  "variant07",
  "variant08",
  "variant09",
  "variant10",
  "variant11",
  "variant12",
  "variant13",
  "variant14",
  "variant15",
  "variant16",
  "variant17",
  "variant18",
  "variant19",
  "variant20",
  "variant21",
  "variant22",
  "variant23",
  "variant24",
  "variant25",
  "variant26",
] as const;

export const AVATAR_GLASSES_VARIANTS = [
  "variant01",
  "variant02",
  "variant03",
  "variant04",
  "variant05",
] as const;

export const AVATAR_MOUTH_VARIANTS = [
  "variant01",
  "variant02",
  "variant03",
  "variant04",
  "variant05",
  "variant06",
  "variant07",
  "variant08",
  "variant09",
  "variant10",
  "variant11",
  "variant12",
  "variant13",
  "variant14",
  "variant15",
  "variant16",
  "variant17",
  "variant18",
  "variant19",
  "variant20",
  "variant21",
  "variant22",
  "variant23",
  "variant24",
  "variant25",
  "variant26",
  "variant27",
  "variant28",
  "variant29",
  "variant30",
] as const;

export const AVATAR_TONE_PALETTE = [
  "f2d3b1",
  "ecad80",
  "9e5622",
  "763900",
  "422828",
  "211414",
  "f8e4f8",
] as const;

const lowerUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
const scaleSchema = z
  .number()
  .min(0.8)
  .max(1.6)
  .refine(
    (value) => Number.isInteger(value * 20),
    "Scale must use 0.05 increments.",
  );

export const avatarOptionsV1Schema = z
  .object({
    eyebrowsVariant: z.enum(AVATAR_EYEBROW_VARIANTS),
    eyesVariant: z.enum(AVATAR_EYE_VARIANTS),
    glassesVariant: z.enum(AVATAR_GLASSES_VARIANTS),
    glassesProbability: z.union([z.literal(0), z.literal(100)]),
    mouthVariant: z.enum(AVATAR_MOUTH_VARIANTS),
    backgroundColor: z.string().regex(/^[0-9a-f]{6}$/),
    scale: scaleSchema,
    rotate: z.number().int().min(-20).max(20),
  })
  .strict();

export const avatarConfigV1Schema = z
  .object({
    version: z.literal(AVATAR_CONFIG_VERSION),
    seed: lowerUuidSchema,
    options: avatarOptionsV1Schema,
  })
  .strict();

export const avatarSaveInputSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    options: avatarOptionsV1Schema,
  })
  .strict();

export const avatarResetInputSchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict();

export type AvatarOptionsV1 = z.infer<typeof avatarOptionsV1Schema>;
export type AvatarConfigV1 = z.infer<typeof avatarConfigV1Schema>;
export type AvatarSaveInput = z.infer<typeof avatarSaveInputSchema>;
export type AvatarResetInput = z.infer<typeof avatarResetInputSchema>;

export const DEFAULT_AVATAR_OPTIONS: AvatarOptionsV1 = Object.freeze({
  eyebrowsVariant: "variant01",
  eyesVariant: "variant01",
  glassesVariant: "variant01",
  glassesProbability: 0,
  mouthVariant: "variant01",
  backgroundColor: "f2d3b1",
  scale: 1,
  rotate: 0,
});

export function parseAvatarConfig(value: unknown): AvatarConfigV1 | null {
  const result = avatarConfigV1Schema.safeParse(value);
  return result.success ? result.data : null;
}

export function createAvatarConfig(
  profileId: string,
  options: unknown,
): AvatarConfigV1 | null {
  return parseAvatarConfig({
    version: AVATAR_CONFIG_VERSION,
    seed: profileId,
    options,
  });
}

export function normalizeAvatarColor(value: string): string {
  return value.trim().replace(/^#/, "").toLowerCase();
}

export function avatarConfigFingerprint(config: AvatarConfigV1): string {
  const canonical = JSON.stringify(config);
  let hash = 2_166_136_261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `avatar-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
