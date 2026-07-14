import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function localSupabaseEnv() {
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
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([^=]+)="(.*)"$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2]]),
  );
}

async function promoteLatestTestAsset() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !env.PUBLISHABLE_KEY ||
    !process.env.TEST_AUTH_EMAIL ||
    !process.env.TEST_AUTH_PASSWORD
  )
    throw new Error("Refusing E2E asset promotion outside local Supabase.");
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const actor = createClient(env.API_URL, env.PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await actor.auth.signInWithPassword({
    email: process.env.TEST_AUTH_EMAIL,
    password: process.env.TEST_AUTH_PASSWORD,
  });
  if (signInError) throw signInError;
  const { data: asset, error: assetError } = await actor
    .from("assets")
    .select("id")
    .eq("status", "processing")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (assetError) throw assetError;
  const bytes = await readFile(
    path.join(process.cwd(), "public", "fixtures", "audio", "stem-a.wav"),
  );
  const { error } = await admin.rpc("operator_promote_source_asset", {
    p_asset_id: asset.id,
    p_media_type: "audio/wav",
    p_byte_size: bytes.byteLength,
    p_sha256: createHash("sha256").update(bytes).digest("hex"),
    p_duration_ms: 2_000,
    p_sample_rate_hz: 44_100,
    p_channels: 1,
    p_verification_version: "playwright-fixture-v1",
  });
  if (error) throw error;
}

test.describe("identity vertical slice", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("onboards, publishes, edits, and signs out", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(
      page.getByRole("heading", { name: "Create your public profile" }),
    ).toBeVisible();

    await page.getByLabel("Username").fill("E2EArtist");
    await page.getByLabel("Display name").fill("E2E Artist");
    await page.getByLabel("Credit name").fill("E2E Credit");
    await page.getByLabel("Bio").fill("A safe public test biography.");
    await page.getByRole("button", { name: "Complete profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "New project" })
      .click();
    await page.getByLabel("Title").fill("E2E collaboration draft");
    await page.getByLabel("Description").fill("A private project test.");
    await page.getByLabel("BPM").fill("118.5");
    await page.getByLabel("Musical key").selectOption("d-minor");
    await page.getByLabel("Electronic", { exact: true }).check();
    await page.getByLabel("Electronic as primary genre").check();
    await page.getByLabel("Collaboration wanted", { exact: true }).check();
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(
      page.getByRole("heading", { name: "E2E collaboration draft" }),
    ).toBeVisible();
    const projectUrl = new URL(page.url()).pathname;
    await page.reload();
    await expect(page.getByText("118.5 BPM")).toBeVisible();
    await page.getByRole("link", { name: "Edit metadata" }).click();
    await page.getByLabel("Title").fill("Edited collaboration draft");
    await page.getByRole("button", { name: "Save project" }).click();
    await expect(page.getByText("Project saved.")).toBeVisible();

    await page.goto("/uploads");
    await page
      .getByLabel("Choose source audio")
      .setInputFiles("public/fixtures/audio/stem-a.wav");
    await expect(
      page
        .getByText("Upload complete. Starting audio verification…", {
          exact: true,
        })
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await promoteLatestTestAsset();

    await page.goto(`${projectUrl}/publish`);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Publish first revision" }).click();
    await expect(page.getByText("Published arrangement")).toBeVisible();
    await page.getByRole("link", { name: "Open studio" }).click();
    await page.getByRole("button", { name: "Create editable draft" }).click();
    await expect(page.getByText("Private draft from revision 1")).toBeVisible();
    let releaseSource: (() => void) | undefined;
    let observeSource: (() => void) | undefined;
    const sourceRequested = new Promise<void>((resolve) => {
      observeSource = resolve;
    });
    const holdSource = new Promise<void>((resolve) => {
      releaseSource = resolve;
    });
    await page.route("**/storage/v1/object/sign/**", async (route) => {
      observeSource?.();
      await holdSource;
      await route.continue();
    });
    await page.getByRole("button", { name: "Open studio" }).click();
    await sourceRequested;
    await expect(page.getByLabel("Track label")).toBeVisible({
      timeout: 2_000,
    });
    await expect(
      page.getByRole("button", { name: "Play playback" }),
    ).toBeDisabled();
    await expect(
      page.getByText(/0 of 1 tracks ready · loading audio/),
    ).toBeVisible();
    releaseSource?.();
    await expect(
      page.getByRole("button", { name: "Play playback" }),
    ).toBeEnabled({
      timeout: 30_000,
    });
    await page.unroute("**/storage/v1/object/sign/**");
    await page.getByLabel("Track label").fill("Saved browser stem");
    await page.getByLabel("Track label").press("Tab");
    await expect(
      page.getByText("Unsaved changes", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.reload();
    await page.getByRole("button", { name: "Open studio" }).click();
    await expect(page.getByLabel("Track label")).toHaveValue(
      "Saved browser stem",
      { timeout: 30_000 },
    );

    await page.goto("/@E2EArtist");
    await expect(
      page.getByRole("heading", { name: "E2E Artist" }),
    ).toBeVisible();
    await expect(page.getByText("A safe public test biography.")).toBeVisible();

    await page.goto("/settings/profile");
    await page.getByLabel("Display name").fill("Edited Artist");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  });
});

test("test Auth route is absent when disabled", async ({ page }) => {
  test.skip(process.env.ENABLE_TEST_AUTH === "true", "enabled local test run");
  const response = await page.goto("/test-auth");
  expect(response?.status()).toBe(404);
});
