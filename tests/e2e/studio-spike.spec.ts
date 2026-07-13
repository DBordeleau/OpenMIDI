import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";

test("disabled studio spike is unavailable", async ({ page }) => {
  test.skip(
    process.env.ENABLE_STUDIO_SPIKE === "true",
    "spike is explicitly enabled",
  );
  const response = await page.goto("/__spikes__/studio");
  expect(response?.status()).toBe(404);
});

test("public home requests no editor code or fixture audio", async ({
  page,
}) => {
  const studioRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/waveform|tone|fixtures\/audio/i.test(url)) studioRequests.push(url);
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(studioRequests).toEqual([]);
});

test("authenticated spike loads lazily, edits, restores, and exports", async ({
  page,
}) => {
  test.skip(
    process.env.ENABLE_STUDIO_SPIKE !== "true" ||
      process.env.ENABLE_TEST_AUTH !== "true",
    "requires the explicitly enabled local Auth spike",
  );
  const pageErrors: Error[] = [];
  const audioRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  page.on("request", (request) => {
    if (/fixtures\/audio/i.test(request.url()))
      audioRequests.push(request.url());
  });

  await page.goto("/test-auth");
  await page.getByRole("button", { name: "Sign in test actor" }).click();
  await expect(page).toHaveURL(/\/(onboarding|settings\/profile)$/);
  if (
    await page
      .getByRole("heading", { name: "Create your public profile" })
      .isVisible()
  ) {
    await page.getByLabel("Username").fill("SpikeArtist");
    await page.getByLabel("Display name").fill("Spike Artist");
    await page.getByLabel("Credit name").fill("Spike Credit");
    await page.getByRole("button", { name: "Complete profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
  }

  await page.goto("/__spikes__/studio");
  await expect(page.getByRole("button", { name: "Open studio" })).toBeVisible();
  expect(audioRequests).toEqual([]);
  const scriptsBeforeOpen = await page
    .locator('script[src*="/_next/"]')
    .count();
  await page.getByRole("button", { name: "Open studio" }).click();
  await expect(
    page.getByText("Ready. Audio was fetched only after this open action."),
  ).toBeVisible();
  expect(audioRequests).toHaveLength(2);
  expect(await page.locator('script[src*="/_next/"]').count()).toBeGreaterThan(
    scriptsBeforeOpen,
  );

  const pulse = page.getByRole("group", { name: /Pulse A/ });
  await pulse.getByLabel("Mute").check();
  await pulse.getByLabel("Position ms").fill("700");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator("p", { hasText: "Status:" })).toContainText(
    "playing",
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByLabel("Seek seconds").fill("0.5");
  await page.getByRole("button", { name: "Add fixture track" }).click();
  await expect(
    page.getByText("track-pulse-copy", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save manifest" }).click();

  await page.reload();
  await page.getByRole("button", { name: "Open studio" }).click();
  await expect(
    page.getByText("track-pulse-copy", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export WAV" }).click();
  const wav = await download;
  expect(wav.suggestedFilename()).toMatch(/\.wav$/);
  expect(statSync(await wav.path()).size).toBeGreaterThan(44);
  expect(pageErrors).toEqual([]);
});
