import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function localSupabaseEnv() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http://127.0.0.1:") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return {
      API_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

  const output =
    process.platform === "win32"
      ? execFileSync(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", "npx supabase status -o env"],
          { encoding: "utf8" },
        )
      : execFileSync("npx", ["supabase", "status", "-o", "env"], {
          encoding: "utf8",
        });
  const values = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([^=]+)="(.*)"$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2]]),
  );
  if (
    !values.API_URL?.startsWith("http://127.0.0.1:") ||
    !values.SERVICE_ROLE_KEY ||
    !values.PUBLISHABLE_KEY
  )
    throw new Error("Refusing transition E2E outside local Supabase.");
  return values as {
    API_URL: string;
    PUBLISHABLE_KEY: string;
    SERVICE_ROLE_KEY: string;
  };
}

test.describe("source-admission transition", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("blocks stale UI, direct RPC, and direct Storage bypasses while preserving upload history", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const env = localSupabaseEnv();
    const actor = createClient(env.API_URL, env.PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const operator = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await actor.auth.signInWithPassword({
      email: process.env.TEST_AUTH_EMAIL ?? "jam-session-e2e@example.test",
      password: process.env.TEST_AUTH_PASSWORD ?? "jam-session-local-e2e-only",
    });
    if (signInError) throw signInError;

    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await page.waitForURL((url) => url.pathname !== "/test-auth");
    await page.goto("/uploads");

    const { count: assetsBefore } = await actor
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("kind", "source_audio");

    try {
      const { error: disableError } = await operator.rpc(
        "operator_set_source_admission_enabled",
        { p_enabled: false },
      );
      if (disableError) throw disableError;

      const sourcePath = path.join(
        process.cwd(),
        "public",
        "fixtures",
        "audio",
        "stem-a.wav",
      );
      await page.getByLabel("Choose source audio").setInputFiles(sourcePath);
      await page.getByRole("button", { name: "Upload original WAV" }).click();
      await expect(
        page.getByText(
          /Audio uploads are unavailable during the prototype while Jam Session evaluates sustainable storage/i,
        ),
      ).toBeVisible();

      const { error: rpcError } = await actor.rpc("reserve_source_asset", {
        p_request_id: crypto.randomUUID(),
        p_expected_byte_size: 1024,
        p_filename: "old-client.wav",
        p_declared_media_type: "audio/wav",
        p_client_duration_ms: 1000,
        p_expected_sha256: null,
      });
      expect(rpcError?.message).toBe("audio_uploads_unavailable");

      const { error: storageError } = await actor.storage
        .from("source-audio")
        .upload(`${crypto.randomUUID()}/bypass/source`, new Blob(["blocked"]));
      expect(storageError).not.toBeNull();

      const { count: assetsAfter } = await actor
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("kind", "source_audio");
      expect(assetsAfter).toBe(assetsBefore);

      await page.reload();
      await expect(page.getByLabel("Choose source audio")).toBeDisabled();
      await expect(
        page.getByRole("heading", { name: "Recent uploads" }),
      ).toBeVisible();
    } finally {
      const { error: enableError } = await operator.rpc(
        "operator_set_source_admission_enabled",
        { p_enabled: true },
      );
      if (enableError) throw enableError;
    }

    await page.reload();
    await expect(page.getByLabel("Choose source audio")).toBeEnabled();
    await expect(
      page.getByText(
        /Audio uploads are unavailable during the prototype while Jam Session evaluates sustainable storage/i,
      ),
    ).toHaveCount(0);
  });
});
