import { expect, test } from "@playwright/test";

test("loads the OpenMIDI landing without browser errors", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/");

  await expect(page).toHaveTitle("OpenMIDI - A MIDI Playground");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "The song is",
  );
  // The landing ships its own transparent nav instead of the shared header.
  const navigation = page.getByRole("navigation", { name: "Primary" });
  await expect(navigation).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "The MIDI Library" }),
  ).toHaveAttribute("href", "#library");
  await expect(
    navigation.getByRole("link", { name: "Sign In" }),
  ).toHaveAttribute("href", "/sign-in");
  await expect(
    page.getByRole("link", { name: "Create Something" }).first(),
  ).toHaveAttribute("href", "/sign-in");
  await expect(
    page.getByRole("link", { name: "Join the beta" }),
  ).toHaveAttribute("href", "/sign-in");
  expect(pageErrors).toEqual([]);
});

test("keeps the pointer landing on its snapping scroll port", async ({
  page,
}) => {
  await page.goto("/");

  // The mobile pass hands scrolling back to the document on coarse pointers.
  // This pins the other half of that contract: with a mouse, the landing is
  // still its own snapping scroll container.
  const scroll = await page
    .locator("[data-landing-scroll]")
    .evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        overflowY: style.overflowY,
        snapType: style.scrollSnapType,
        scrollable: node.scrollHeight > node.clientHeight + 1,
      };
    });

  expect(scroll.overflowY).toBe("auto");
  // `proximity` is the initial strictness, so `y proximity` serializes to `y`.
  expect(scroll.snapType).toMatch(/^y\b/);
  expect(scroll.scrollable).toBe(true);
});

test("supports keyboard navigation and narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Skip to main content" }).press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  const joinBeta = page.getByRole("link", { name: "Join the beta" });
  await joinBeta.scrollIntoViewIfNeeded();
  await expect(joinBeta).toBeInViewport();
});

test("renders a useful not-found state", async ({ page }) => {
  await page.goto("/missing-page");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Sections" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toHaveAttribute(
    "href",
    "/",
  );
});
