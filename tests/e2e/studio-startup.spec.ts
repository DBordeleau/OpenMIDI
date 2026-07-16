import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

test.describe("MIDI-only Studio v3", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("creates, edits, recovers, publishes, and exports an exact multi-track arrangement without Storage audio", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const actorId = await ensureStudioActorProfile();
    const forbiddenRequests: string[] = [];
    page.on("request", (request) => {
      if (
        /audio-sources|downloads\/stems|storage\/v1\/object|waveform|source-loader/i.test(
          request.url(),
        )
      ) {
        forbiddenRequests.push(request.url());
      }
    });

    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await page.goto("/studio");

    const title = `MIDI v3 ${randomUUID().slice(0, 8)}`;
    await createProjectInStudio(page, title);
    const projectId = page.url().split("/").at(-1)!;
    await expect(
      page.getByRole("region", { name: "Arrangement workspace" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Add a track" }).click();
    await page.getByLabel("Pending track name").fill("Warm keys");
    await page.getByRole("button", { name: "Open piano roll" }).click();
    await page.getByRole("button", { name: "Add note" }).click();
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Private draft saved.")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Freeze and add pattern" }).click();
    await expect(
      page.getByText(/Pattern version 1 is immutable and was added/),
    ).toBeVisible({ timeout: 15_000 });

    const keysClip = page.getByRole("button", {
      name: /MIDI clip on Warm keys/,
    });
    await keysClip.focus();
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    await expect(keysClip).toHaveCount(2);
    await page
      .getByRole("button", { name: /Select track Warm keys\./ })
      .click();
    await page.getByRole("button", { name: "Duplicate MIDI track" }).click();
    await expect(
      page.getByRole("button", { name: /MIDI clip on Warm keys copy/ }),
    ).toHaveCount(2);
    await expect(page.getByText("Arrangement saved.")).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(keysClip).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: /MIDI clip on Warm keys copy/ }),
    ).toHaveCount(2);

    const midiDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: ".mid" }).click();
    expect((await midiDownload).suggestedFilename()).toMatch(/\.mid$/);
    const wavDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "WAV" }).click();
    expect((await wavDownload).suggestedFilename()).toMatch(/\.wav$/);

    await page
      .getByRole("button", { name: "Publish immutable revision" })
      .click();
    await expect(
      page.getByText(
        "Revision 1 published with exact pattern and arrangement versions.",
      ),
    ).toBeVisible({ timeout: 15_000 });

    const admin = localAdmin();
    const { data: revision, error: revisionError } = await admin
      .from("project_revisions")
      .select(
        "id,arrangement_version_id,manifest_version,engine,engine_version,manifest",
      )
      .eq("project_id", projectId)
      .eq("revision_number", 1)
      .single();
    if (revisionError) throw revisionError;
    expect(revision.manifest_version).toBe(3);
    expect(revision.engine).toBe("jam-session-midi");
    expect(revision.arrangement_version_id).toBeTruthy();
    expect(JSON.stringify(revision.manifest)).not.toMatch(
      /assetId|signedUrl|waveform|positionMs|trimStartMs/,
    );

    const [{ count: trackCount }, { count: clipCount }] = await Promise.all([
      admin
        .from("arrangement_tracks")
        .select("track_id", { count: "exact", head: true })
        .eq("arrangement_version_id", revision.arrangement_version_id!),
      admin
        .from("arrangement_clips")
        .select("clip_id", { count: "exact", head: true })
        .eq("arrangement_version_id", revision.arrangement_version_id!),
    ]);
    expect(trackCount).toBe(2);
    expect(clipCount).toBe(4);

    const snapshotCount = Number(
      execFileSync(
        "docker",
        [
          "exec",
          "-i",
          "supabase_db_jam-session",
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-Atc",
          `select count(*) from private.workspace_snapshots s join public.workspaces w on w.id=s.workspace_id where w.project_id='${projectId}' and s.owner_id='${actorId}'`,
        ],
        { encoding: "utf8" },
      ).trim(),
    );
    expect(snapshotCount).toBeGreaterThan(0);
    expect(snapshotCount).toBeLessThanOrEqual(20);

    await page.goto(`/projects/${projectId}#revision-1`);
    await expect(page.getByText("Current revision 1")).toBeVisible();
    expect(forbiddenRequests).toEqual([]);
  });
});

async function createProjectInStudio(
  page: import("@playwright/test").Page,
  title: string,
) {
  await page
    .getByRole("navigation", { name: "Studio" })
    .getByText("File", { exact: true })
    .click();
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a project" });
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel(/BPM/).fill("120");
  await dialog.getByLabel("License").selectOption("cc-by-4.0");
  await dialog
    .getByRole("button", { name: "Create project and open Studio" })
    .click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]+$/);
}

function localAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.startsWith("http://127.0.0.1:") || !serviceRoleKey)
    throw new Error("Studio E2E requires the local Supabase stack.");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureStudioActorProfile() {
  const email = process.env.TEST_AUTH_EMAIL;
  if (!email) throw new Error("TEST_AUTH_EMAIL is required.");
  const admin = localAdmin();
  const { data: users, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  const actor = users.users.find((user) => user.email === email);
  if (!actor)
    throw new Error("Local E2E actor setup did not create the actor.");
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_jam-session",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `update public.profiles set username='StudioE2EActor', username_normalized='studioe2eactor', display_name='Studio E2E actor', credit_name='Studio E2E actor', profile_completed_at=coalesce(profile_completed_at,now()) where id='${actor.id}'`,
    ],
    { encoding: "utf8" },
  );
  return actor.id;
}
