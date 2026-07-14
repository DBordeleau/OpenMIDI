import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

async function prepareMidiActor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.TEST_AUTH_EMAIL;
  const password = process.env.TEST_AUTH_PASSWORD;
  if (
    !url?.startsWith("http://127.0.0.1:") ||
    !serviceRoleKey ||
    !publishableKey ||
    !email ||
    !password
  )
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
  const actorClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await actorClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;
  const { error: profileError } = await actorClient
    .from("profiles")
    .update({
      username: "MidiStemE2E",
      username_normalized: "midisteme2e",
      display_name: "MIDI Stem E2E",
      credit_name: "MIDI Stem E2E",
      profile_completed_at: new Date().toISOString(),
      status: "active",
    })
    .eq("id", actor.id);
  if (profileError) throw profileError;
}

test.describe("standalone MIDI stem editor", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("creates, edits, autosaves, and reloads a canonical draft", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await prepareMidiActor();
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await page.goto("/stems");
    await expect(page.getByRole("heading", { name: "My stems" })).toBeVisible();
    await expect(page.getByText("A quiet canvas.")).not.toBeVisible();

    await page.getByRole("link", { name: "New MIDI stem" }).click();
    await page.getByLabel("Stem name").fill("E2E night chords");
    await page.getByRole("button", { name: "Open MIDI editor" }).click();
    await expect(
      page.getByRole("heading", { name: "Shape a reusable stem" }),
    ).toBeVisible();

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
    await expect(noteList.locator("option").first()).toContainText("D2");

    const roll = page.getByTestId("midi-piano-roll");
    await roll.focus();
    await roll.press("ArrowRight");
    await expect(noteList.locator("option").first()).toContainText("tick 120");
    await page.getByRole("button", { name: "Quantize" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(noteList.locator("option").first()).toContainText("tick 120");

    await roll.dblclick({ position: { x: 520, y: 220 } });
    await expect(page.getByText(/5 of 2,048 notes/)).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Saved to My stems.", {
      timeout: 10_000,
    });

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Stem name" })).toHaveValue(
      "E2E night chords",
    );
    await expect(page.getByText(/5 of 2,048 notes/)).toBeVisible();
    await expect(
      page.getByLabel("Notes in stem").locator("option").first(),
    ).toContainText("D2 · tick 120");

    await page.getByRole("link", { name: "Back to My stems" }).click();
    await expect(
      page.getByRole("link", { name: "E2E night chords" }),
    ).toBeVisible();
    await expect(page.getByText("Warm Poly · 5 notes")).toBeVisible();
  });
});
