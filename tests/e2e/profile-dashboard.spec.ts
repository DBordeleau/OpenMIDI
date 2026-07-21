import { expect, test } from "@playwright/test";

test.describe("profile dashboard navigation", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true" ||
      process.env.ENABLE_PROFILE_DASHBOARD_E2E !== "true",
    "requires explicit local Auth/Storage profile fixture authorization",
  );

  test("opens the bounded dashboard and responsive navigation", async ({
    page,
  }) => {
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    if (
      await page
        .getByRole("heading", { name: "Create your public profile" })
        .isVisible()
    ) {
      await page.getByLabel(/Username/).fill("DashboardE2E");
      await page.getByLabel("Display name").fill("Dashboard E2E");
      await page.getByLabel(/Credit name/).fill("Dashboard E2E");
      await page.getByRole("button", { name: "Complete profile" }).click();
    }
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /awaiting review/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Owned projects" }),
    ).toBeVisible();
    // At phone width the header steps back and the thumb-zone tab bar carries
    // navigation; grouped destinations arrive in bottom sheets.
    await page.setViewportSize({ width: 320, height: 800 });
    const mobile = page.getByRole("navigation", { name: "Primary mobile" });
    await expect(mobile).toBeVisible();
    await expect(
      mobile.getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("button", { name: "Account menu" }),
    ).toBeHidden();

    await mobile.getByRole("button", { name: "Explore" }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Explore" })
        .getByRole("link", { name: "MIDI Library" }),
    ).toBeVisible();

    await mobile.getByRole("button", { name: "Account" }).click();
    const account = page.getByRole("dialog", { name: "Account" });
    await expect(
      account.getByRole("link", { name: "My projects" }),
    ).toBeVisible();
    await expect(
      account.getByRole("button", { name: "Sign out" }),
    ).toBeVisible();
  });
});
