import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

test.describe("MIDI-only Studio v3", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("creates, edits, recovers, publishes, and exports an exact multi-track MIDI arrangement", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const actorId = await ensureStudioActorProfile();
    const forbiddenRequests: string[] = [];
    page.on("request", (request) => {
      if (
        /storage\/v1\/object|functions\/v1|dicebear|avatar.*(?:png|svg)|\.(?:mp3|wav|ogg)(?:\?|$)/i.test(
          request.url(),
        )
      ) {
        forbiddenRequests.push(request.url());
      }
    });

    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
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
    await page.getByRole("button", { name: "Perform a take" }).click();
    await page.getByLabel("One-bar count-in").uncheck();
    await page.getByLabel("Metronome").uncheck();
    await page.getByRole("button", { name: "Record", exact: true }).click();
    for (const name of ["Play C4, MIDI note 60", "Play E4, MIDI note 64"]) {
      const key = page.getByRole("button", { name });
      await key.dispatchEvent("pointerdown", { pointerId: 1 });
      await key.dispatchEvent("pointerup", { pointerId: 1 });
    }
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByText("Private draft saved.")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Freeze and add pattern" }).click();
    await expect(
      page.getByText(/Pattern version 1 is immutable and was added/).first(),
    ).toBeVisible({ timeout: 15_000 });

    const keysClip = page.getByRole("button", {
      name: /MIDI clip on Warm keys,/,
    });
    await keysClip.focus();
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    await expect(keysClip).toHaveCount(2);
    await page
      .getByRole("button", { name: /Select track Warm keys\./ })
      .click();
    await page.getByRole("button", { name: "Duplicate Warm keys" }).click();
    await expect(
      page.getByRole("button", { name: /MIDI clip on Warm keys copy,/ }),
    ).toHaveCount(2);
    await expect(page.getByText("Arrangement saved.")).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(keysClip).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: /MIDI clip on Warm keys copy,/ }),
    ).toHaveCount(2);

    const midiDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: ".mid" }).click();
    expect((await midiDownload).suggestedFilename()).toMatch(/\.mid$/);
    const wavDownload = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByRole("button", { name: "WAV" }).click();
    expect((await wavDownload).suggestedFilename()).toMatch(/\.wav$/);

    const studioActionRequests: string[] = [];
    const trackStudioAction = (request: import("@playwright/test").Request) => {
      if (
        request.method() === "POST" &&
        request.headers()["next-action"] &&
        request.url() === page.url()
      )
        studioActionRequests.push(request.headers()["next-action"]!);
    };
    page.on("request", trackStudioAction);
    await expect(
      page.getByRole("button", { name: "Add from clips" }),
    ).toBeVisible();
    expect(studioActionRequests).toEqual([]);
    const studioUrlBeforeImport = page.url();
    let mainFrameNavigations = 0;
    const trackNavigation = (frame: import("@playwright/test").Frame) => {
      if (frame === page.mainFrame()) mainFrameNavigations += 1;
    };
    page.on("framenavigated", trackNavigation);

    await page.getByRole("button", { name: "Add from clips" }).click();
    const drawer = page.getByRole("dialog", { name: "Add from clips" });
    await expect(drawer).toBeVisible();
    await expect
      .poll(() => studioActionRequests.length)
      .toBeGreaterThanOrEqual(1);
    await drawer.getByRole("tab", { name: "Saved clips" }).click();
    await expect(drawer.getByText("No saved clips yet")).toBeVisible();
    await drawer.getByRole("tab", { name: "My clips" }).click();
    const search = drawer.getByPlaceholder("Title or creator");
    await search.fill("Warm keys");
    const beforeSearch = studioActionRequests.length;
    await drawer.getByRole("button", { name: "Search" }).click();
    await expect
      .poll(() => studioActionRequests.length)
      .toBeGreaterThan(beforeSearch);
    await expect(drawer.getByText("Warm keys", { exact: true })).toBeVisible();

    const preview = drawer.getByRole("button", {
      name: "Preview Warm keys",
    });
    const beforePreview = studioActionRequests.length;
    await preview.click();
    await expect
      .poll(() => studioActionRequests.length)
      .toBeGreaterThan(beforePreview);
    await expect(
      drawer.getByRole("button", { name: "Pause Warm keys" }),
    ).toBeVisible();

    const playhead = page.getByRole("slider", {
      name: "Arrangement playhead",
    });
    await playhead.click({ position: { x: 96, y: 12 } });
    await expect(playhead).toHaveAttribute("aria-valuenow", "480");
    const beforeImport = studioActionRequests.length;
    await drawer.getByRole("button", { name: "Add as new track" }).click();
    await expect(
      page.getByRole("button", {
        name: /MIDI clip on Warm keys, Bar 1 · Beat 2,/,
      }),
    ).toBeFocused({ timeout: 15_000 });
    await expect(
      page.getByText("Warm keys was added on a new track at the playhead."),
    ).toBeVisible();
    await expect(drawer).toBeHidden();
    expect(page.url()).toBe(studioUrlBeforeImport);
    expect(mainFrameNavigations).toBe(0);
    expect(studioActionRequests.length).toBe(beforeImport + 1);
    await page.waitForTimeout(1_100);
    expect(studioActionRequests.length).toBe(beforeImport + 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Add from clips" }).click();
    await expect(drawer).toBeVisible();
    await expect
      .poll(() =>
        drawer.evaluate((element) => ({
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        })),
      )
      .toMatchObject({
        left: 0,
        right: 390,
      });
    await page.setViewportSize({ width: 320, height: 844 });
    await expect
      .poll(() =>
        drawer.evaluate((element) => ({
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        })),
      )
      .toMatchObject({
        left: 0,
        right: 320,
      });
    expect(
      await drawer.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Add from clips" }),
    ).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Add from clips" }).click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS("transform", "none");
    await page.keyboard.press("Escape");
    page.off("framenavigated", trackNavigation);
    page.off("request", trackStudioAction);

    await page
      .getByRole("button", { name: "Publish immutable revision" })
      .click();
    await expect(
      page.getByText(
        "Revision 1 published with exact pattern and arrangement versions.",
      ),
    ).toBeVisible({ timeout: 15_000 });

    const revision = JSON.parse(
      queryLocalDatabase(`select json_build_object(
        'id',id,'arrangementVersionId',arrangement_version_id,
        'manifestVersion',manifest_version,'engine',engine,
        'engineVersion',engine_version,'manifest',manifest
      )::text from public.project_revisions
      where project_id='${projectId}' and revision_number=1`),
    ) as {
      id: string;
      arrangementVersionId: string;
      manifestVersion: number;
      engine: string;
      engineVersion: string;
      manifest: unknown;
    };
    expect(revision.manifestVersion).toBe(3);
    expect(revision.engine).toBe("openmidi-midi");
    expect(revision.arrangementVersionId).toBeTruthy();

    const counts = JSON.parse(
      queryLocalDatabase(`select json_build_object(
        'trackCount',(select count(*) from public.arrangement_tracks where arrangement_version_id='${revision.arrangementVersionId}'),
        'clipCount',(select count(*) from public.arrangement_clips where arrangement_version_id='${revision.arrangementVersionId}')
      )::text`),
    ) as { trackCount: number; clipCount: number };
    expect(counts.trackCount).toBe(3);
    expect(counts.clipCount).toBe(5);

    const snapshotCount = Number(
      queryLocalDatabase(
        `select count(*) from private.workspace_snapshots s join public.workspaces w on w.id=s.workspace_id where w.project_id='${projectId}' and s.owner_id='${actorId}'`,
      ),
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
  await page.getByRole("button", { name: /Project menu/ }).click();
  await page.getByRole("menuitem", { name: "New project" }).click();
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

function queryLocalDatabase(sql: string) {
  return execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_openmidi",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
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
      "supabase_db_openmidi",
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
