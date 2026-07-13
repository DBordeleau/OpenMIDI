import { z } from "zod";

export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
  storageTusUrl: string;
};

export type SupabasePublicEnvInput = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_STORAGE_TUS_URL?: string;
};

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_URL is required." })
    .trim()
    .refine(
      (value) => {
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      },
      {
        error: "NEXT_PUBLIC_SUPABASE_URL must be an absolute HTTP(S) URL.",
      },
    ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required." })
    .trim()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must not be empty."),
  NEXT_PUBLIC_SUPABASE_STORAGE_TUS_URL: z.string().url().optional(),
});

export function parseSupabasePublicEnv(
  input: SupabasePublicEnvInput,
): SupabasePublicEnv {
  const result = publicEnvSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      result.error.issues.map((issue) => issue.message).join(" "),
    );
  }

  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    storageTusUrl:
      result.data.NEXT_PUBLIC_SUPABASE_STORAGE_TUS_URL ??
      `${result.data.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/upload/resumable`,
  };
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  return parseSupabasePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_STORAGE_TUS_URL:
      process.env.NEXT_PUBLIC_SUPABASE_STORAGE_TUS_URL,
  });
}
