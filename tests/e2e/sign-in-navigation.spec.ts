import { expect, test, type Page } from "@playwright/test";

async function openLandingSignIn(page: Page) {
  const trigger = page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Sign In" });
  await expect(trigger).toHaveAttribute("href", "/sign-in");
  await trigger.click();
  await expect(page).toHaveURL(/\/sign-in$/);
  return trigger;
}

test("intercepts landing sign-in with focus, history, and request containment", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const requestsAfterOpen: { resourceType: string; url: string }[] = [];
  page.on("request", (request) =>
    requestsAfterOpen.push({
      resourceType: request.resourceType(),
      url: request.url(),
    }),
  );

  const trigger = await openLandingSignIn(page);
  const dialog = page.getByRole("dialog", {
    name: "Open beta coming soon!",
  });
  const close = page.getByRole("button", { name: "Close sign in" });
  const google = page.getByRole("button", { name: "Continue with Google" });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "The song is the source." }),
  ).toBeVisible();
  await expect(close).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

  await page.keyboard.press("Shift+Tab");
  await expect(google).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  expect(
    requestsAfterOpen.filter(
      ({ resourceType, url }) =>
        resourceType === "media" ||
        url.includes("supabase.co") ||
        url.includes("/storage/v1/"),
    ),
  ).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

  await page.goForward();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "The song is the source." }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("keeps direct and refreshed sign-in as the complete fallback", async ({
  page,
}) => {
  await page.goto("/sign-in?next=%2Fonboarding%3Ffrom%3Dpolish");
  await expect(
    page.getByRole("dialog", { name: "Open beta coming soon!" }),
  ).toBeVisible();
  await expect(page.locator('input[name="next"]')).toHaveValue(
    "/onboarding?from=polish",
  );
  await expect(
    page.getByRole("heading", { name: "The song is the source." }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Close and return home" }).click();
  await expect(page).toHaveURL(/\/$/);

  await openLandingSignIn(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Close and return home" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The song is the source." }),
  ).toBeHidden();
});

test("fits the sign-in card at mobile and short landscape sizes", async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await openLandingSignIn(page);
    const dialog = page.getByRole("dialog", {
      name: "Open beta coming soon!",
    });
    const close = page.getByRole("button", { name: "Close sign in" });
    const [dialogBox, closeBox] = await Promise.all([
      dialog.boundingBox(),
      close.boundingBox(),
    ]);
    expect(dialogBox).not.toBeNull();
    expect(closeBox).not.toBeNull();
    expect(dialogBox!.y).toBeGreaterThanOrEqual(16);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(
      viewport.height - 16,
    );
    expect(closeBox!.width).toBeGreaterThanOrEqual(44);
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(page).toHaveURL(/\/$/);
  }
});

test.describe("reduced motion", () => {
  test("opens and closes without spatial animation", async ({ page }) => {
    await page.goto("/");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openLandingSignIn(page);
    const dialog = page.getByRole("dialog", {
      name: "Open beta coming soon!",
    });
    const animations = await dialog.evaluate((element) =>
      element.getAnimations().map((animation) => animation.effect?.getTiming()),
    );
    expect(
      animations.every((timing) => Number(timing?.duration ?? 0) <= 1),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
  });
});

test("anchors desktop dropdowns distinctly and preserves the mobile sheet origin", async ({
  page,
}) => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  await page.goto("/test-auth");
  await page.getByRole("button", { name: "Sign in test actor" }).click();
  await page.waitForURL(/\/(onboarding|dashboard)$/);
  if (
    await page
      .getByRole("heading", { name: "Create your public profile" })
      .isVisible()
  ) {
    await page.getByLabel("Username").fill("PolishNavE2E");
    await page.getByLabel("Display name").fill("Polish Nav E2E");
    await page.getByLabel("Credit name").fill("Polish Nav E2E");
    await page.getByRole("button", { name: "Complete profile" }).click();
  }
  await page.goto("/dashboard");
  await page.setViewportSize({ width: 820, height: 1000 });

  const exploreTrigger = page.getByRole("button", { name: "Explore" });
  await exploreTrigger.click();
  const explorePanelId = await exploreTrigger.getAttribute("aria-controls");
  expect(explorePanelId).toBeTruthy();
  const explorePanel = page.locator(`[id="${explorePanelId}"]`);
  const [exploreTriggerBox, explorePanelBox] = await Promise.all([
    exploreTrigger.boundingBox(),
    explorePanel.boundingBox(),
  ]);
  expect(exploreTriggerBox).not.toBeNull();
  expect(explorePanelBox).not.toBeNull();
  expect(
    Math.abs(explorePanelBox!.x - exploreTriggerBox!.x),
  ).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(exploreTrigger).toBeFocused();

  const accountTrigger = page.getByRole("button", { name: "Account menu" });
  await accountTrigger.click();
  const accountPanelId = await accountTrigger.getAttribute("aria-controls");
  expect(accountPanelId).toBeTruthy();
  const accountPanel = page.locator(`[id="${accountPanelId}"]`);
  const [accountTriggerBox, accountPanelBox] = await Promise.all([
    accountTrigger.boundingBox(),
    accountPanel.boundingBox(),
  ]);
  expect(accountTriggerBox).not.toBeNull();
  expect(accountPanelBox).not.toBeNull();
  expect(
    Math.abs(
      accountPanelBox!.x +
        accountPanelBox!.width -
        (accountTriggerBox!.x + accountTriggerBox!.width),
    ),
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(explorePanelBox!.x - accountPanelBox!.x)).toBeGreaterThan(40);
  expect(accountPanelBox!.x).toBeGreaterThanOrEqual(0);
  expect(accountPanelBox!.x + accountPanelBox!.width).toBeLessThanOrEqual(820);

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileNav = page.getByRole("navigation", { name: "Primary mobile" });
  const mobileExplore = mobileNav.getByRole("button", { name: "Explore" });
  const mobileAccount = mobileNav.getByRole("button", { name: "Account" });
  const mobileNavBox = await mobileNav.boundingBox();
  expect(mobileNavBox).not.toBeNull();
  await mobileExplore.click();
  const exploreSheet = page.getByRole("dialog", { name: "Explore" });
  await expect
    .poll(async () => {
      const box = await exploreSheet.boundingBox();
      return box ? box.y + box.height - mobileNavBox!.y : Number.NaN;
    })
    .toBeCloseTo(0, 1);
  const exploreSheetBox = await exploreSheet.boundingBox();
  await mobileAccount.click();
  const accountSheet = page.getByRole("dialog", { name: "Account" });
  await expect
    .poll(async () => {
      const box = await accountSheet.boundingBox();
      return box ? box.y + box.height - mobileNavBox!.y : Number.NaN;
    })
    .toBeCloseTo(0, 1);
  const accountSheetBox = await accountSheet.boundingBox();
  expect(exploreSheetBox).not.toBeNull();
  expect(accountSheetBox).not.toBeNull();
  expect(accountSheetBox!.x).toBe(exploreSheetBox!.x);
  expect(accountSheetBox!.width).toBe(exploreSheetBox!.width);
});
