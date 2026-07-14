import { expect, test } from "@playwright/test";

test("loads the Jam Session product shell without browser errors", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/");

  await expect(page).toHaveTitle("Jam Session");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Your song isn't done.",
  );
  const navigation = page.getByRole("navigation", { name: "Sections" });
  await expect(navigation).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Explore" }),
  ).toHaveAttribute("href", "/explore");
  await expect(
    navigation.getByRole("link", { name: "How it works" }),
  ).toHaveAttribute("href", "/#how");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Sign in" }),
  ).toHaveAttribute("href", "/sign-in");
  await expect(
    page.getByRole("link", { name: "Explore projects" }),
  ).toHaveAttribute("href", "/explore");
  expect(pageErrors).toEqual([]);
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
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [...document.body.querySelectorAll<HTMLElement>("*")]
      .map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
      }))
      .filter(({ rect }) => rect.left < -1 || rect.right > viewportWidth + 1)
      .slice(0, 10)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className.toString().slice(0, 160),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      }));
    return {
      clientWidth: viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders,
    };
  });
  expect(overflow.scrollWidth, JSON.stringify(overflow, null, 2)).toBe(
    overflow.clientWidth,
  );
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
