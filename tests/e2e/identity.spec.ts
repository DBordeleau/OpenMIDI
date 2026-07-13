import { expect, test } from "@playwright/test";

test.describe("identity vertical slice", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("onboards, publishes, edits, and signs out", async ({ page }) => {
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
