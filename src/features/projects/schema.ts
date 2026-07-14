import { z } from "zod";

export const musicalKeys = [
  "c-major",
  "c-sharp-major",
  "d-major",
  "e-flat-major",
  "e-major",
  "f-major",
  "f-sharp-major",
  "g-major",
  "a-flat-major",
  "a-major",
  "b-flat-major",
  "b-major",
  "c-minor",
  "c-sharp-minor",
  "d-minor",
  "e-flat-minor",
  "e-minor",
  "f-minor",
  "f-sharp-minor",
  "g-minor",
  "g-sharp-minor",
  "a-minor",
  "b-flat-minor",
  "b-minor",
] as const;

const optionalBpm = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.union([
    z.null(),
    z
      .string()
      .regex(/^\d{1,3}(?:\.\d{1,3})?$/, "Use up to three decimal places.")
      .transform(Number)
      .pipe(z.number().min(20).max(400)),
  ]),
);

export const projectInputSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title.").max(120),
    description: z
      .string()
      .trim()
      .max(5000)
      .transform((value) => value || null),
    bpm: optionalBpm,
    musicalKey: z
      .union([z.literal(""), z.enum(musicalKeys)])
      .transform((value) => value || null),
    timeSignatureNumerator: z.coerce.number().int().min(1).max(32),
    timeSignatureDenominator: z.coerce
      .number()
      .int()
      .refine(
        (value) => [1, 2, 4, 8, 16, 32].includes(value),
        "Choose a supported denominator.",
      ),
    licenseCode: z.string().min(1),
    genreIds: z
      .array(z.string().uuid())
      .max(3)
      .refine(
        (value) => new Set(value).size === value.length,
        "Choose each genre once.",
      ),
    primaryGenreId: z
      .union([z.literal(""), z.string().uuid()])
      .transform((value) => value || null),
    tagIds: z
      .array(z.string().uuid())
      .max(10)
      .refine(
        (value) => new Set(value).size === value.length,
        "Choose each tag once.",
      ),
  })
  .refine(
    (value) =>
      value.primaryGenreId === null ||
      value.genreIds.includes(value.primaryGenreId),
    {
      path: ["primaryGenreId"],
      message: "The primary genre must also be selected.",
    },
  );

export const projectIdSchema = z.string().uuid();
export const deleteProjectSchema = z.object({
  projectId: projectIdSchema,
  requestId: z.string().uuid(),
  expectedLockVersion: z.number().int().positive(),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;
