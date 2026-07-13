import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  SITE_URL: z
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
  ENABLE_TEST_AUTH: z.enum(["true", "false"]).default("false"),
  TEST_AUTH_EMAIL: z.string().email().endsWith("@example.test").optional(),
  TEST_AUTH_PASSWORD: z.string().min(8).optional(),
});

export function getServerEnv() {
  const parsed = serverEnvSchema.parse({
    SITE_URL: process.env.SITE_URL ?? "http://127.0.0.1:3000",
    ENABLE_TEST_AUTH: process.env.ENABLE_TEST_AUTH ?? "false",
    TEST_AUTH_EMAIL: process.env.TEST_AUTH_EMAIL,
    TEST_AUTH_PASSWORD: process.env.TEST_AUTH_PASSWORD,
  });
  return {
    siteUrl: parsed.SITE_URL,
    enableTestAuth: parsed.ENABLE_TEST_AUTH === "true",
    testAuthEmail: parsed.TEST_AUTH_EMAIL,
    testAuthPassword: parsed.TEST_AUTH_PASSWORD,
  };
}
