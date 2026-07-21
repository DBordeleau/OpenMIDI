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
    await page.setViewportSize({ width: 320, height: 800 });
    await page.getByText("Menu", { exact: true }).click();
    const mobile = page.getByRole("navigation", { name: "Primary mobile" });
    await expect(
      mobile.getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      mobile.getByRole("link", { name: "MIDI Library" }),
    ).toBeVisible();
    // Account destinations live behind the avatar control, which stays visible
    // at 320px instead of hiding inside the disclosure.
    const account = page.getByRole("button", { name: "Account menu" });
    await expect(account).toBeVisible();
    await account.click();
    await expect(page.getByRole("link", { name: "My projects" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });
});
