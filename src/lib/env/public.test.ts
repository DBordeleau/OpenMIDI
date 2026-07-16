import { describe, expect, it } from "vitest";

import { parseSupabasePublicEnv } from "./public";

describe("parseSupabasePublicEnv", () => {
  it.each([
    ["http://127.0.0.1:54321", "sb_publishable_local"],
    ["https://example.supabase.co", "hosted-key"],
  ])("accepts public configuration for %s", (url, publishableKey) => {
    expect(
      parseSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      }),
    ).toEqual({
      url,
      publishableKey,
    });
  });

  it.each([
    [{}, "NEXT_PUBLIC_SUPABASE_URL"],
    [
      { NEXT_PUBLIC_SUPABASE_URL: "https://example.com" },
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ],
    [
      {
        NEXT_PUBLIC_SUPABASE_URL: "/relative",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key",
      },
      "NEXT_PUBLIC_SUPABASE_URL",
    ],
    [
      {
        NEXT_PUBLIC_SUPABASE_URL: "ftp://example.com",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key",
      },
      "NEXT_PUBLIC_SUPABASE_URL",
    ],
    [
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.com",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "   ",
      },
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ],
  ])(
    "rejects invalid configuration without exposing values",
    (input, variableName) => {
      expect(() => parseSupabasePublicEnv(input)).toThrow(variableName);
      try {
        parseSupabasePublicEnv(input);
      } catch (error) {
        expect(String(error)).not.toContain("ftp://example.com");
      }
    },
  );
});
