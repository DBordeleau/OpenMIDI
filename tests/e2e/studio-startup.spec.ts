import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  serializeWaveformPeaks,
  WAVEFORM_PEAKS_BIN_COUNT,
} from "../../src/features/assets/waveform-peaks/contract";

test.describe("studio startup smoke", () => {
  let closeFixtureDelivery: (() => Promise<void>) | null = null;

  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await closeFixtureDelivery?.();
    closeFixtureDelivery = null;
  });

  test("opens the authenticated start center without starting browser audio", async ({
    page,
  }) => {
    await ensureStudioActorProfile();
    await page.addInitScript(() => {
      const state = window as Window & {
        __jamAudioContextConstructions?: number;
      };
      state.__jamAudioContextConstructions = 0;
      for (const name of ["AudioContext", "webkitAudioContext"] as const) {
        const original = window[name as keyof Window];
        if (typeof original !== "function") continue;
        Object.defineProperty(window, name, {
          configurable: true,
          value: new Proxy(original, {
            construct(target, argumentsList, newTarget) {
              state.__jamAudioContextConstructions =
                (state.__jamAudioContextConstructions ?? 0) + 1;
              return Reflect.construct(target, argumentsList, newTarget);
            },
          }),
        });
      }
    });

    await page.goto("/studio");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fstudio$/);
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);

    const privateSourceRequests: string[] = [];
    page.on("request", (request) => {
      if (/audio-sources|storage\/v1\/object/i.test(request.url()))
        privateSourceRequests.push(request.url());
    });
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Studio" })
      .click();

    await expect(page).toHaveURL(/\/studio$/);
    await expect(
      page.getByRole("region", { name: "Blank arrangement workspace" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No project open" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Play arrangement" }),
    ).toBeDisabled();
    await page
      .getByRole("navigation", { name: "Studio" })
      .getByText("File", { exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "New project" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Open project" }),
    ).toBeEnabled();
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Close project" }),
    ).toBeDisabled();
    expect(privateSourceRequests).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          (window as Window & { __jamAudioContextConstructions?: number })
            .__jamAudioContextConstructions ?? 0,
      ),
    ).toBe(0);
  });

  test("creates projects inside Studio and switches clean sessions", async ({
    page,
  }) => {
    await ensureStudioActorProfile();
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await page.goto("/studio");

    const firstTitle = `Studio project ${randomUUID().slice(0, 8)}`;
    const secondTitle = `Studio switch ${randomUUID().slice(0, 8)}`;
    await createProjectInStudio(page, firstTitle);
    const firstUrl = page.url();
    await expect(
      page.getByRole("heading", { name: `${firstTitle} studio` }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Arrangement workspace" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bring in your first MIDI part." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Play arrangement" }),
    ).toBeDisabled();
    await expect(page.getByText("All changes saved")).toBeVisible();

    await createProjectInStudio(page, secondTitle);
    await openProjectBrowserInStudio(page);
    const firstProject = page
      .getByRole("listitem")
      .filter({ hasText: firstTitle });
    await expect(
      firstProject.getByText("Private owner workspace"),
    ).toBeVisible();
    await firstProject.getByRole("button", { name: "Open in Studio" }).click();
    await expect(page).toHaveURL(firstUrl);

    for (const title of [secondTitle, firstTitle, secondTitle, firstTitle]) {
      await openProjectBrowserInStudio(page);
      await page
        .getByRole("listitem")
        .filter({ hasText: title })
        .getByRole("button", { name: "Open in Studio" })
        .click();
      await expect(
        page.getByRole("region", { name: "Arrangement workspace" }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("heading", { name: "Perform a take" }),
      ).toHaveCount(0);
    }
    await expect(page).toHaveURL(firstUrl);
  });

  test("composes, records, and atomically replaces one MIDI clip in Studio", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await ensureStudioActorProfile();
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await page.goto("/studio");
    await createProjectInStudio(
      page,
      `Integrated MIDI ${randomUUID().slice(0, 8)}`,
    );

    await page.getByRole("button", { name: "Add a track" }).click();
    await page.getByLabel("Pending track name").fill("New MIDI part");
    await page.getByRole("button", { name: "Open piano roll" }).click();
    await expect(
      page.getByRole("heading", { name: "Perform a take" }),
    ).toBeVisible();
    const integratedRoll = page.getByTestId("midi-piano-roll");
    const integratedViewport = await integratedRoll.evaluate((element) => {
      const scroller = element.parentElement?.parentElement;
      if (!(scroller instanceof HTMLElement))
        throw new Error("Piano-roll scroller is unavailable");
      return {
        height: scroller.clientHeight,
        scrollTop: scroller.scrollTop,
        middleCRow: Number(element.dataset.middleCRow),
      };
    });
    expect(
      Math.abs(
        integratedViewport.middleCRow * 22 +
          11 -
          integratedViewport.scrollTop -
          integratedViewport.height / 2,
      ),
    ).toBeLessThanOrEqual(12);
    const c4Key = page.getByRole("button", {
      name: "Play C4, MIDI note 60",
    });
    await integratedRoll.focus();
    await page.keyboard.down("a");
    await expect(c4Key).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.up("a");
    await expect(c4Key).toHaveAttribute("aria-pressed", "false");
    const cSharp4Key = page.getByRole("button", {
      name: /MIDI note 61/,
    });
    const c4Box = await c4Key.boundingBox();
    const cSharp4Box = await cSharp4Key.boundingBox();
    if (!c4Box || !cSharp4Box)
      throw new Error("Performance keys are not laid out");
    await page.mouse.move(
      c4Box.x + c4Box.width / 2,
      c4Box.y + c4Box.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      cSharp4Box.x + cSharp4Box.width / 2,
      cSharp4Box.y + cSharp4Box.height / 2,
      { steps: 3 },
    );
    await expect(c4Key).toHaveAttribute("aria-pressed", "false");
    await expect(cSharp4Key).toHaveAttribute("aria-pressed", "true");
    await page.mouse.up();
    await expect(cSharp4Key).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.getByRole("button", { name: "Publish immutable revision" }),
    ).toBeDisabled();

    await page.getByRole("button", { name: "Add note" }).click();
    await page.getByRole("button", { name: "Select", exact: true }).click();
    const rollBox = await integratedRoll.boundingBox();
    const rollGeometry = await integratedRoll.evaluate((element) => {
      const scroller = element.parentElement?.parentElement;
      if (!(scroller instanceof HTMLElement))
        throw new Error("Piano-roll scroller is unavailable");
      return {
        middleCRow: Number(element.dataset.middleCRow),
        scrollLeft: scroller.scrollLeft,
        scrollTop: scroller.scrollTop,
      };
    });
    if (!rollBox) throw new Error("Piano roll is not laid out");
    const notePitch = Number(await page.getByLabel("MIDI pitch").inputValue());
    const noteStartTick = Number(
      await page.getByLabel("Start tick").inputValue(),
    );
    const noteDurationTicks = Number(
      await page.getByLabel("Duration ticks").inputValue(),
    );
    const maxPitch = rollGeometry.middleCRow + 60;
    let noteLeft =
      rollBox.x + 88 + (noteStartTick / 480) * 88 - rollGeometry.scrollLeft;
    const noteTop =
      rollBox.y + (maxPitch - notePitch) * 22 - rollGeometry.scrollTop + 3;
    const noteWidth = Math.max(7, (noteDurationTicks / 480) * 88);
    const noteCenterY = noteTop + 8;
    await page.mouse.move(
      rollBox.x + rollBox.width - 4,
      rollBox.y + rollBox.height - 4,
    );
    await page.mouse.down();
    await page.mouse.move(rollBox.x + 89, rollBox.y + 1, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByText(/1 selected/)).toBeVisible();

    await page.mouse.move(noteLeft + Math.min(10, noteWidth / 2), noteCenterY);
    await page.mouse.down();
    await page.mouse.move(
      noteLeft + Math.min(10, noteWidth / 2) + 22,
      noteCenterY,
      { steps: 3 },
    );
    await page.mouse.up();
    await expect(
      page.getByLabel("Notes in stem").locator("option").first(),
    ).toContainText("tick 120");

    noteLeft += 22;
    await page.keyboard.down("Control");
    await page.mouse.move(noteLeft + Math.min(10, noteWidth / 2), noteCenterY);
    await page.mouse.down();
    await page.mouse.move(
      noteLeft + Math.min(10, noteWidth / 2) + 22,
      noteCenterY,
      { steps: 3 },
    );
    await page.mouse.up();
    await page.keyboard.up("Control");
    await expect(page.getByText(/2 of 2,048 notes/)).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(/1 of 2,048 notes/)).toBeVisible();
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(page.getByText(/2 of 2,048 notes/)).toBeVisible();
    await expect(page.getByText("Private draft saved.")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByLabel("One-bar count-in").uncheck();
    await page.getByLabel("Metronome").uncheck();
    await page.getByRole("button", { name: "Record" }).click();
    await expect(page.getByText(/Recording · tick/)).toBeVisible();
    await page.keyboard.down("a");
    await page.waitForTimeout(120);
    await page.keyboard.up("a");
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByText("Private draft saved.")).toBeVisible({
      timeout: 10_000,
    });
    await page
      .getByRole("button", { name: "Save version and add to arrangement" })
      .click();
    await expect(
      page.getByText(/immutable and was added to the arrangement/),
    ).toBeVisible({ timeout: 10_000 });

    const arrangedClip = page.getByRole("button", {
      name: /MIDI clip on New MIDI part/,
    });
    await expect(arrangedClip).toBeFocused();
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    await expect(arrangedClip).toHaveCount(2);
    await expect(page.getByText("Arrangement saved.")).toBeVisible({
      timeout: 10_000,
    });

    await page.reload();
    const clips = page.getByRole("button", {
      name: /MIDI clip on New MIDI part/,
    });
    await expect(clips).toHaveCount(2);
    const clip = clips.first();
    await expect(clip).toBeVisible();
    await page
      .getByRole("button", { name: /Select track New MIDI part\./ })
      .click();
    await page.getByRole("button", { name: "Duplicate MIDI track" }).click();
    await expect(
      page.getByRole("button", { name: /MIDI clip on New MIDI part copy/ }),
    ).toHaveCount(2);
    await clip.click();
    await page.keyboard.press("Control+c");
    await page.getByRole("button", { name: "Add a track" }).click();
    await page.getByLabel("Pending track name").fill("Layered keys");
    await page.getByRole("button", { name: "Paste compatible clip" }).click();
    await expect(
      page.getByRole("button", { name: /MIDI clip on Layered keys/ }),
    ).toHaveCount(1);

    await clips.nth(1).scrollIntoViewIfNeeded();
    const sourceBox = await clips.nth(1).boundingBox();
    const targetLaneBox = await page
      .getByRole("listitem")
      .filter({
        has: page.getByRole("button", { name: /Select track Layered keys\./ }),
      })
      .locator("[data-arranger-track-id]")
      .boundingBox();
    if (!sourceBox || !targetLaneBox)
      throw new Error("Track lanes not laid out");
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      targetLaneBox.y + targetLaneBox.height / 2,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(
      page.getByRole("button", { name: /MIDI clip on Layered keys/ }),
    ).toHaveCount(2);
    const spacedClip = page
      .getByRole("button", { name: /MIDI clip on Layered keys/ })
      .nth(1);
    await spacedClip.scrollIntoViewIfNeeded();
    const spacedClipBox = await spacedClip.boundingBox();
    if (!spacedClipBox) throw new Error("MIDI clip not laid out");
    await page.mouse.move(
      spacedClipBox.x + spacedClipBox.width / 2,
      spacedClipBox.y + spacedClipBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      spacedClipBox.x + spacedClipBox.width / 2 + 50,
      spacedClipBox.y + spacedClipBox.height / 2,
      { steps: 4 },
    );
    await page.mouse.up();
    await expect(page.getByLabel("Start tick")).toHaveValue("7920");
    await expect(page.getByText("Arrangement saved.")).toBeVisible({
      timeout: 10_000,
    });
    await page.reload();
    await expect(
      page.getByRole("button", { name: /MIDI clip on Layered keys/ }),
    ).toHaveCount(2);
    await page
      .getByRole("button", { name: /MIDI clip on Layered keys/ })
      .nth(1)
      .click();
    await expect(page.getByLabel("Start tick")).toHaveValue("7920");

    await clip.dblclick();
    await expect(
      page.getByRole("heading", { name: "Edit New MIDI part" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Derive exact version" }).click();
    await expect(page.getByText(/3 of 2,048 notes/)).toBeVisible();
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Private draft saved.")).toBeVisible({
      timeout: 10_000,
    });
    await page
      .getByRole("button", {
        name: "Save new version and replace clip",
      })
      .click();
    await expect(
      page.getByText(/immutable and replaced only the selected clip/),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /^MIDI clip on New MIDI part,/ }),
    ).toHaveCount(1);

    await page.getByLabel("New MIDI part compact gain").fill("-3");
    await expect(page.getByText("Arrangement saved.")).toBeVisible({
      timeout: 10_000,
    });

    await page.locator("summary").filter({ hasText: "Actions" }).click();
    const exportPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export .mid" }).first().click();
    const exportedMidi = await exportPromise;
    expect(exportedMidi.suggestedFilename()).toMatch(/\.mid$/);

    await page
      .getByRole("button", { name: "Publish immutable revision" })
      .click();
    await expect(
      page.getByText("Revision 1 published with exact MIDI stem references."),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: "Return to project" }).click();
    await expect(page.getByText("Current revision 1")).toBeVisible();
    await page.getByRole("button", { name: /Play Integrated MIDI/ }).click();
    await expect(page.getByText("Now playing")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("link", { name: "Fork this revision" }).click();
    await page.getByLabel("Project title").fill("Integrated MIDI fork");
    await page.getByRole("button", { name: "Create private fork" }).click();
    await expect(page.getByText("Private fork created.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Integrated MIDI fork" }),
    ).toBeVisible();
  });

  test("opens an editable published revision in one navigation", async ({
    page,
  }) => {
    test.setTimeout(75_000);
    const { peakBytes, sourceBytes, ...fixture } = await setupStudioFixture();
    const delivery = await startFixtureDelivery(sourceBytes, peakBytes);
    closeFixtureDelivery = delivery.close;

    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);

    const switchTitle = `Safe switch ${randomUUID().slice(0, 8)}`;
    await page.goto("/studio");
    await createProjectInStudio(page, switchTitle);
    const switchUrl = page.url();

    // Local Storage on Windows/Docker can return signed-object headers while
    // stalling the response body. The preflight below verifies both real
    // objects. Keep the real authorized descriptor/signing request, assert its
    // private paths, then point only this fixture at deterministic loopback
    // responses containing those exact bytes.
    const fixtureSourceUrl = delivery.sourceUrl;
    const fixturePeakUrl = delivery.peakUrl;
    await page.route(
      new RegExp(
        `/api/projects/${fixture.projectId}/workspaces/[^/]+/audio-sources$`,
      ),
      async (route) => {
        const response = await route.fetch();
        if (!response.ok()) {
          await route.fulfill({ response });
          return;
        }
        const payload = (await response.json()) as {
          sources?: Array<{
            assetId: string;
            signedUrl: string;
            peaks: { signedUrl: string } | null;
          }>;
        };
        const source = payload.sources?.find(
          (candidate) => candidate.assetId === fixture.assetId,
        );
        if (!source?.peaks)
          throw new Error("The authorized fixture descriptor omitted peaks.");
        const sourcePath = new URL(source.signedUrl).pathname;
        const peakPath = new URL(source.peaks.signedUrl).pathname;
        if (
          !sourcePath.includes("/object/sign/source-audio/") ||
          !sourcePath.endsWith(`/${fixture.assetId}/source`) ||
          !peakPath.includes("/object/sign/derived-assets/") ||
          !peakPath.includes(`/${fixture.assetId}/`)
        )
          throw new Error(
            `The fixture descriptor returned unexpected private paths: ${JSON.stringify({ sourcePath, peakPath })}`,
          );
        source.signedUrl = fixtureSourceUrl;
        source.peaks.signedUrl = fixturePeakUrl;
        await route.fulfill({ response, json: payload });
      },
    );

    const networkEvents: NetworkEvent[] = [];
    page.on("request", (request) => {
      recordNetworkEvent(networkEvents, "request", request.url(), {
        method: request.method(),
      });
    });
    page.on("response", (response) => {
      recordNetworkEvent(networkEvents, "response", response.url(), {
        method: response.request().method(),
        status: response.status(),
      });
    });
    page.on("requestfailed", (request) => {
      recordNetworkEvent(networkEvents, "requestfailed", request.url(), {
        method: request.method(),
        error: request.failure()?.errorText ?? "unknown",
      });
    });
    await page.goto(`/projects/${fixture.projectId}/studio`);
    await expect(page).toHaveURL(`/studio/${fixture.projectId}`);
    await expect(page.getByText("Private draft from revision 1")).toBeVisible();

    await openProjectBrowserInStudio(page);
    await page
      .getByRole("listitem")
      .filter({ hasText: switchTitle })
      .getByRole("button", { name: "Open in Studio" })
      .click();
    await expect(page).toHaveURL(switchUrl);

    await page.goto(`/studio/${fixture.projectId}`);
    await expect(page.getByLabel("Fixture stem label")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText("Waveform ready from persisted peaks."),
      `Persisted peaks did not become ready: ${JSON.stringify({ fixture, networkEvents })}`,
    ).toBeAttached({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: "Play playback" }),
      `Fixture audio did not become playable: ${JSON.stringify({ fixture, networkEvents })}`,
    ).toBeEnabled({ timeout: 15_000 });

    const trackLabel = page.getByLabel("Fixture stem label");
    await trackLabel.fill("Saved browser stem");
    await trackLabel.press("Tab");
    await openProjectBrowserInStudio(page);
    await page
      .getByRole("listitem")
      .filter({ hasText: switchTitle })
      .getByRole("button", { name: "Open in Studio" })
      .click();
    await expect(page).toHaveURL(switchUrl);

    await page.goto(`/studio/${fixture.projectId}`);
    await expect(page.getByLabel("Saved browser stem label")).toHaveValue(
      "Saved browser stem",
      { timeout: 30_000 },
    );

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
        `update public.workspaces set lock_version=lock_version+1 where project_id='${fixture.projectId}' and status='active'`,
      ],
      { encoding: "utf8" },
    );
    const savedTrackLabel = page.getByLabel("Saved browser stem label");
    await savedTrackLabel.fill("Conflict recovery stem");
    await savedTrackLabel.press("Tab");
    await expect(
      page.getByRole("alert").filter({ hasText: "changed in another tab" }),
    ).toBeVisible({ timeout: 30_000 });
    await openProjectBrowserInStudio(page);
    await page
      .getByRole("listitem")
      .filter({ hasText: switchTitle })
      .getByRole("button", { name: "Open in Studio" })
      .click();
    await page.getByRole("button", { name: "Leave with recovery" }).click();
    await expect(page).toHaveURL(switchUrl);
    await page.goto(`/studio/${fixture.projectId}`);
    await expect(
      page.getByRole("alert").filter({ hasText: "Pending changes found" }),
    ).toBeVisible();
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
  await dialog.getByLabel("License").selectOption("cc-by-4.0");
  await dialog
    .getByRole("button", { name: "Create project and open Studio" })
    .click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]+$/);
}

async function openProjectBrowserInStudio(
  page: import("@playwright/test").Page,
) {
  await page
    .getByRole("navigation", { name: "Studio" })
    .getByText("File", { exact: true })
    .click();
  await page.getByRole("button", { name: "Open project" }).click();
}

async function ensureStudioActorProfile() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.TEST_AUTH_EMAIL;
  if (!url?.startsWith("http://127.0.0.1:") || !serviceRoleKey || !email)
    throw new Error(
      "Studio actor setup requires npm run test:e2e:studio against local Supabase.",
    );
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
}

async function setupStudioFixture() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.TEST_AUTH_EMAIL;
  if (!url?.startsWith("http://127.0.0.1:") || !serviceRoleKey || !email)
    throw new Error(
      "Studio fixture preflight requires npm run test:e2e:studio against local Supabase.",
    );
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;
  const actor = users.users.find((user) => user.email === email);
  if (!actor)
    throw new Error("Local E2E actor setup did not create the actor.");

  const projectId = randomUUID();
  const revisionId = randomUUID();
  const assetId = randomUUID();
  const derivativeId = randomUUID();
  const trackId = randomUUID();
  const sourcePath = path.join(
    process.cwd(),
    "public",
    "fixtures",
    "audio",
    "stem-a.wav",
  );
  const bytes = await readFile(sourcePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const peakValues = new Float32Array(WAVEFORM_PEAKS_BIN_COUNT * 2);
  const peakBytes = serializeWaveformPeaks({
    sourceAssetId: assetId,
    channels: 1,
    durationMs: 2_000,
    sampleRateHz: 44_100,
    binCount: WAVEFORM_PEAKS_BIN_COUNT,
    values: peakValues,
  });
  const peakSha256 = createHash("sha256").update(peakBytes).digest("hex");
  const peakObjectPath = `${actor.id}/${assetId}/${derivativeId}/peaks.v1.bin`;
  const manifest = JSON.stringify({
    manifestVersion: 1,
    engine: "waveform-playlist",
    engineVersion: "browser-15.3.4_playout-12.5.4_tone-15.1.22",
    workspaceId: projectId,
    tempoBpm: 120,
    tracks: [
      {
        trackId,
        assetId,
        instrumentId: null,
        name: "Fixture stem",
        positionMs: 0,
        trimStartMs: 0,
        durationMs: 2000,
        gainDb: 0,
        pan: 0,
        muted: false,
        soloed: false,
        sortOrder: 0,
      },
    ],
  }).replaceAll("'", "''");
  const sql = `begin;
    update public.profiles set username='StudioE2EActor', username_normalized='studioe2eactor', display_name='Studio E2E actor', credit_name='Studio E2E actor', profile_completed_at=coalesce(profile_completed_at,now()) where id='${actor.id}';
    insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code) values('${projectId}','${actor.id}','${randomUUID()}','Studio startup fixture',120,'cc-by-4.0');
    insert into public.project_members(project_id,user_id,role,created_by) values('${projectId}','${actor.id}','owner','${actor.id}');
    set constraints all immediate; set constraints all deferred;
    insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at) values('${assetId}','${actor.id}','ready','${actor.id}/${assetId}/source','stem-a.wav',${bytes.byteLength},'audio/wav',${bytes.byteLength},'${sha256}',2000,44100,1,'playwright-fixture-v1',now());
    insert into public.asset_credits(asset_id,position,user_id,credit_name,role) values('${assetId}',0,'${actor.id}','Studio E2E actor','creator');
    update public.assets set credits_confirmed_at=ready_at,credits_confirmation_request_id=id,credits_confirmation_sha256=repeat('c',64) where id='${assetId}';
    insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms) values('${revisionId}','${projectId}',1,'${actor.id}','${randomUUID()}','Fixture revision','${manifest}'::jsonb,1,'waveform-playlist','browser-15.3.4_playout-12.5.4_tone-15.1.22',encode(extensions.digest(convert_to('${manifest}'::jsonb::text,'UTF8'),'sha256'),'hex'),2000);
    insert into public.revision_tracks(revision_id,id,asset_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by) values('${revisionId}','${trackId}','${assetId}','Fixture stem',0,0,2000,0,0,false,false,0,'${actor.id}');
    insert into public.project_asset_references(project_id,asset_id,first_revision_id,added_by) values('${projectId}','${assetId}','${revisionId}','${actor.id}');
    insert into public.project_storage_usage(project_id,source_bytes,unique_source_count) values('${projectId}',${bytes.byteLength},1);
    update public.projects set status='active',current_revision_id='${revisionId}',published_at=now(),lock_version=2 where id='${projectId}';
    insert into public.waveform_peak_derivatives(id,source_asset_id,owner_id,request_id,status,object_path,expected_byte_size,byte_size,sha256,format_version,algorithm_version,channels,duration_ms,sample_rate_hz,bin_count,expires_at,ready_at)
    values('${derivativeId}','${assetId}','${actor.id}','${randomUUID()}','ready','${peakObjectPath}',${peakBytes.byteLength},${peakBytes.byteLength},'${peakSha256}',1,'pcm-minmax-v1',1,2000,44100,2048,now()+interval '24 hours',now());
    update public.global_storage_usage set derived_bytes=derived_bytes+${peakBytes.byteLength} where singleton;
    commit;`;
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
      sql,
    ],
    { encoding: "utf8" },
  );
  const objectPath = `${actor.id}/${assetId}/source`;
  const { error: uploadError } = await admin.storage
    .from("source-audio")
    .upload(objectPath, bytes, {
      contentType: "audio/wav",
      upsert: true,
    });
  if (uploadError) throw uploadError;
  const { error: peakUploadError } = await admin.storage
    .from("derived-assets")
    .upload(peakObjectPath, peakBytes, {
      contentType: "application/vnd.jam-session.waveform-peaks",
      upsert: true,
    });
  if (peakUploadError) throw peakUploadError;
  const { data: stored, error: downloadError } = await admin.storage
    .from("source-audio")
    .download(objectPath);
  if (downloadError || stored.size !== bytes.byteLength)
    throw new Error(
      `Studio fixture Storage preflight failed: ${JSON.stringify({ assetId, expectedBytes: bytes.byteLength, storedBytes: stored?.size, error: downloadError?.message })}`,
    );
  const { data: storedPeak, error: peakDownloadError } = await admin.storage
    .from("derived-assets")
    .download(peakObjectPath);
  const storedPeakBytes = storedPeak
    ? Buffer.from(await storedPeak.arrayBuffer())
    : null;
  if (
    peakDownloadError ||
    !storedPeakBytes ||
    storedPeakBytes.byteLength !== peakBytes.byteLength ||
    createHash("sha256").update(storedPeakBytes).digest("hex") !== peakSha256
  )
    throw new Error(
      `Studio peak fixture Storage preflight failed: ${JSON.stringify({ assetId, expectedBytes: peakBytes.byteLength, storedBytes: storedPeakBytes?.byteLength, error: peakDownloadError?.message })}`,
    );
  return {
    projectId,
    assetId,
    databaseStatus: "ready",
    storedBytes: stored.size,
    peakBytes: Buffer.from(peakBytes),
    sourceBytes: bytes,
  };
}

async function startFixtureDelivery(sourceBytes: Buffer, peakBytes: Buffer) {
  const server = createServer((request, response) => {
    const send = (body: Buffer, contentType: string) => {
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "Content-Length": body.byteLength,
        "Content-Type": contentType,
      });
      response.end(body);
    };
    if (request.url === "/peaks") {
      send(peakBytes, "application/vnd.jam-session.waveform-peaks");
      return;
    }
    if (request.url === "/source") {
      setTimeout(() => send(sourceBytes, "audio/wav"), 1_500);
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("The studio fixture delivery server did not bind.");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    sourceUrl: `${baseUrl}/source`,
    peakUrl: `${baseUrl}/peaks`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

type NetworkEvent = {
  event: "request" | "response" | "requestfailed";
  method: string;
  path: string;
  status?: number;
  error?: string;
};

function recordNetworkEvent(
  events: NetworkEvent[],
  event: NetworkEvent["event"],
  rawUrl: string,
  details: Omit<NetworkEvent, "event" | "path">,
) {
  const { pathname } = new URL(rawUrl);
  if (
    !pathname.endsWith("/audio-sources") &&
    !pathname.startsWith("/storage/v1/object/")
  )
    return;
  events.push({ event, path: pathname, ...details });
}
