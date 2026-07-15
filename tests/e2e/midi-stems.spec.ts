import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

async function prepareMidiActor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.TEST_AUTH_EMAIL;
  if (!url?.startsWith("http://127.0.0.1:") || !serviceRoleKey || !email)
    throw new Error(
      "MIDI stem E2E requires the targeted local Auth/Storage runner.",
    );
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  const actor = data.users.find((user) => user.email === email);
  if (!actor) throw new Error("Local E2E actor is missing.");
  if (!/^[0-9a-f-]{36}$/.test(actor.id))
    throw new Error("Local E2E actor has an invalid identifier.");
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
      `update public.profiles set username='MidiStemE2E', username_normalized='midisteme2e', display_name='MIDI Stem E2E', credit_name='MIDI Stem E2E', profile_completed_at=coalesce(profile_completed_at, statement_timestamp()), status='active' where id='${actor.id}'`,
    ],
    { encoding: "utf8" },
  );
}

test.describe("standalone MIDI stem editor", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("creates, records, publishes, downloads, and imports an exact MIDI stem", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await prepareMidiActor();
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit profile" }),
    ).toBeVisible();
    await page.goto("/stems");
    await expect(page.getByRole("heading", { name: "My stems" })).toBeVisible();
    await expect(page.getByText("A quiet canvas.")).not.toBeVisible();

    await page.getByRole("link", { name: "New MIDI stem" }).click();
    await page.getByLabel("Stem name").fill("E2E night chords");
    await page.getByRole("button", { name: "Open MIDI editor" }).click();
    await expect(
      page.getByRole("heading", { name: "Shape a reusable stem" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Add starter pattern" }).click();
    await expect(page.getByText(/4 of 2,048 notes/)).toBeVisible();
    await page.getByRole("button", { name: "Play stem" }).click();
    await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
    await page.getByRole("button", { name: "Stop" }).click();
    const noteList = page.getByLabel("Notes in stem");
    await noteList.selectOption({ index: 0 });
    const pitch = page.getByLabel("MIDI pitch");
    await pitch.fill("50");
    await pitch.press("Enter");
    await expect(noteList.locator("option").first()).toContainText("D3");

    const roll = page.getByTestId("midi-piano-roll");
    await roll.evaluate((element) => element.scrollTo(120, 110));
    await expect(
      page.getByRole("heading", { name: "Piano roll" }),
    ).toBeVisible();
    await roll.focus();
    await roll.press("ArrowRight");
    await expect(noteList.locator("option").first()).toContainText("tick 120");
    await page.getByRole("button", { name: "Quantize" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(noteList.locator("option").first()).toContainText("tick 120");

    await roll.dblclick({ position: { x: 520, y: 220 } });
    await expect(page.getByText(/5 of 2,048 notes/)).toBeVisible();
    await expect(page.getByLabel("Duration ticks")).toHaveValue("480");

    await roll.hover({ position: { x: 612, y: 230 } });
    await expect
      .poll(() => roll.evaluate((element) => element.style.cursor))
      .toBe("ew-resize");

    await roll.click({ button: "right", position: { x: 550, y: 230 } });
    await expect(page.getByText(/4 of 2,048 notes/)).toBeVisible();
    await expect(page.getByText(/removed\./)).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(/5 of 2,048 notes/)).toBeVisible();
    await expect(page.getByText("Private draft saved.")).toBeVisible({
      timeout: 10_000,
    });

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Stem name" })).toHaveValue(
      "E2E night chords",
    );
    await expect(page.getByText(/5 of 2,048 notes/)).toBeVisible();
    await expect(
      page.getByLabel("Notes in stem").locator("option").first(),
    ).toContainText("D3 · tick 120");

    await page.getByLabel("One-bar count-in").uncheck();
    await page.getByLabel("Metronome").uncheck();
    await page.getByRole("button", { name: "Record", exact: true }).click();
    const c4 = page.getByRole("button", {
      name: "Play C4, MIDI note 60",
    });
    await c4.dispatchEvent("pointerdown", { pointerId: 1 });
    await c4.dispatchEvent("pointerup", { pointerId: 1 });
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByText(/6 of 2,048 notes/)).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(/5 of 2,048 notes/)).toBeVisible();
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(page.getByText(/6 of 2,048 notes/)).toBeVisible();
    await expect(page.getByText("Private draft saved.")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Save to My stems" }).click();
    await expect(page.getByText(/Version 1 is immutable/)).toBeVisible();

    await page.getByRole("link", { name: "Back to My stems" }).click();
    await expect(
      page.getByRole("link", { name: "E2E night chords" }).first(),
    ).toBeVisible();
    await expect(page.getByText("Warm Poly · 6 notes").first()).toBeVisible();
    await expect(page.getByText(/6 notes · immutable/)).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("listitem")
      .filter({ hasText: "E2E night chords" })
      .getByRole("button", { name: "Download .mid" })
      .click();
    const download = await downloadPromise;
    const midiPath = await download.path();
    expect(midiPath).toBeTruthy();

    await page.getByRole("link", { name: "Import MIDI" }).click();
    await page.getByLabel("Standard MIDI file").setInputFiles(midiPath!);
    await expect(page.getByText(/6 notes/)).toBeVisible();
    await page
      .getByRole("button", { name: "Import into private draft" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Shape a reusable stem" }),
    ).toBeVisible();
    await expect(page.getByText(/6 of 2,048 notes/)).toBeVisible();
  });
});
