import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type LocalEnv = {
  API_URL: string;
  PUBLISHABLE_KEY: string;
  SERVICE_ROLE_KEY: string;
};

function localSupabaseEnv(): LocalEnv {
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
    throw new Error("Refusing upload optimization E2E outside local Supabase.");
  return values as LocalEnv;
}

function makeSilentWav(durationSeconds: number) {
  const sampleRate = 44_100;
  const dataBytes = durationSeconds * sampleRate * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

test.describe("browser lossless upload optimization", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("converts WAV to canonical FLAC and keeps failure fallback safe", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const env = localSupabaseEnv();
    const actor = createClient(env.API_URL, env.PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: actorSignInError } = await actor.auth.signInWithPassword({
      email: process.env.TEST_AUTH_EMAIL ?? "jam-session-e2e@example.test",
      password: process.env.TEST_AUTH_PASSWORD ?? "jam-session-local-e2e-only",
    });
    if (actorSignInError) throw actorSignInError;
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await page.waitForURL((url) => url.pathname !== "/test-auth");
    if (
      await page
        .getByRole("heading", { name: "Create your public profile" })
        .isVisible()
        .catch(() => false)
    ) {
      await page.getByLabel("Username").fill("LosslessE2E");
      await page.getByLabel("Display name").fill("Lossless E2E");
      await page.getByLabel("Credit name").fill("Lossless E2E");
      await page.getByRole("button", { name: "Complete profile" }).click();
      await expect(page.getByText("Profile saved.")).toBeVisible();
    }
    await page.goto("/uploads");

    const { count: countBefore } = await actor
      .from("assets")
      .select("id", { count: "exact", head: true });
    await page.getByLabel("Choose source audio").setInputFiles({
      name: "cancel-me.wav",
      mimeType: "audio/wav",
      buffer: makeSilentWav(20),
    });
    await page.getByRole("button", { name: "Optimize losslessly" }).click();
    await page.getByRole("button", { name: "Cancel optimization" }).click();
    await expect(page.getByText(/optimization cancelled/i)).toBeVisible();

    await page.getByLabel("Choose source audio").setInputFiles({
      name: "broken.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from("RIFF0000WAVEinvalid"),
    });
    await page.getByRole("button", { name: "Optimize losslessly" }).click();
    await expect(
      page.getByText(/original WAV is still ready to upload/i),
    ).toBeVisible({ timeout: 30_000 });
    const { count: countAfterFailure } = await actor
      .from("assets")
      .select("id", { count: "exact", head: true });
    expect(countAfterFailure).toBe(countBefore);

    const sourcePath = path.join(
      process.cwd(),
      "public",
      "fixtures",
      "audio",
      "stem-a.wav",
    );
    const originalWav = await readFile(sourcePath);
    await page.getByLabel("Choose source audio").setInputFiles(sourcePath);
    await page.getByRole("button", { name: "Optimize losslessly" }).click();
    await expect(page.getByText(/Lossless FLAC ready/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Upload complete/).first()).toBeVisible({
      timeout: 30_000,
    });

    const { data: asset, error: assetError } = await actor
      .from("assets")
      .select("id,bucket,object_path,original_filename,status")
      .eq("original_filename", "stem-a.flac")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (assetError) throw assetError;
    expect(asset.status).toBe("processing");
    expect(asset.original_filename).toBe("stem-a.flac");
    const { data: stored, error: downloadError } = await actor.storage
      .from(asset.bucket)
      .download(asset.object_path);
    if (downloadError) throw downloadError;
    const flacBytes = Buffer.from(await stored.arrayBuffer());
    expect(flacBytes.subarray(0, 4).toString("ascii")).toBe("fLaC");

    execFileSync(
      process.execPath,
      ["scripts/verify-source-asset.mjs", asset.id],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
      },
    );
    const { data: ready, error: readyError } = await actor
      .from("assets")
      .select("status,media_type,duration_ms,sample_rate_hz,channels")
      .eq("id", asset.id)
      .single();
    if (readyError) throw readyError;
    expect(ready).toMatchObject({
      status: "ready",
      media_type: "audio/flac",
      duration_ms: 2_000,
      sample_rate_hz: 44_100,
      channels: 1,
    });

    const roundTrip = await page.evaluate(
      async ({ wavBase64, flacBase64 }) => {
        const decode = (value: string) =>
          Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
            .buffer;
        const context = new AudioContext();
        try {
          const [wav, flac] = await Promise.all([
            context.decodeAudioData(decode(wavBase64)),
            context.decodeAudioData(decode(flacBase64)),
          ]);
          const wavSamples = wav.getChannelData(0);
          const flacSamples = flac.getChannelData(0);
          let maxDelta = 0;
          for (let index = 0; index < wavSamples.length; index += 1)
            maxDelta = Math.max(
              maxDelta,
              Math.abs((wavSamples[index] ?? 0) - (flacSamples[index] ?? 0)),
            );
          return {
            maxDelta,
            wavLength: wavSamples.length,
            flacLength: flacSamples.length,
          };
        } finally {
          await context.close();
        }
      },
      {
        wavBase64: originalWav.toString("base64"),
        flacBase64: flacBytes.toString("base64"),
      },
    );
    expect(roundTrip.flacLength).toBe(roundTrip.wavLength);
    expect(roundTrip.maxDelta).toBe(0);
  });
});
