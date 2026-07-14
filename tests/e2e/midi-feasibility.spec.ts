import { expect, test } from "@playwright/test";

test("MIDI-01 guarded feasibility harness", async ({ page }) => {
  await page.goto("/midi-feasibility");
  await expect(
    page.getByRole("heading", { name: "MIDI engine feasibility" }),
  ).toBeVisible();
  await expect(page.getByText("16 tracks / 16,384 notes")).toBeVisible();
  await expect(page.getByText("16,384 events", { exact: false })).toBeVisible();

  const velocity = page.getByLabel("Velocity");
  await velocity.fill("101");
  await expect(velocity).toHaveValue("101");

  await page.getByRole("button", { name: "Audition preset" }).click();
  await expect(page.getByRole("status")).toContainText(
    "−3 dB limiter with −6 dB output safety",
    { timeout: 15_000 },
  );

  await page.getByRole("button", { name: "Benchmark all presets" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "All seven preset graphs rendered without samples.",
    { timeout: 30_000 },
  );
  await expect(
    page.locator("li").filter({ hasText: "Studio Drums" }),
  ).toContainText("peak");
});
