import { devices, expect, test } from "@playwright/test";

/**
 * The landing's mobile contract. Desktop keeps a nested snapping scroll port
 * driven by the wheel; a touch device hands scrolling back to the document and
 * drops snapping, because proximity snap resolves after a thumb lifts and reads
 * as the page overriding the reader.
 */
test.use({ ...devices["Pixel 5"] });

test.describe("landing on a phone", () => {
  test("scrolls the document instead of a nested snapping port", async ({
    page,
  }) => {
    await page.goto("/");
    const root = page.locator("[data-landing-scroll]");
    await expect(root).toBeVisible();

    const scroll = await root.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        overflowY: style.overflowY,
        snapType: style.scrollSnapType,
        scrollable: node.scrollHeight > node.clientHeight + 1,
      };
    });

    // `overflow-x: hidden` would force this back to `auto`; the rule uses
    // `clip` precisely so it can stay `visible`.
    expect(scroll.overflowY).toBe("visible");
    expect(scroll.snapType).toBe("none");
    expect(scroll.scrollable).toBe(false);

    // The document is the scroll port now, so the page must actually move.
    const before = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy(0, 600));
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(before);
  });

  test("keeps the scroll cue clear of the now-playing pill", async ({
    page,
  }) => {
    await page.goto("/");

    const cue = page
      .getByRole("link", { name: "Scroll to next section" })
      .first();
    const nowPlaying = page.locator("[data-now-playing]");
    await expect(cue).toBeVisible();
    await expect(nowPlaying).toBeVisible();

    const cueBox = await cue.boundingBox();
    const pillBox = await nowPlaying.boundingBox();
    expect(cueBox).not.toBeNull();
    expect(pillBox).not.toBeNull();

    const overlaps =
      cueBox!.x < pillBox!.x + pillBox!.width &&
      pillBox!.x < cueBox!.x + cueBox!.width &&
      cueBox!.y < pillBox!.y + pillBox!.height &&
      pillBox!.y < cueBox!.y + cueBox!.height;
    expect(overlaps).toBe(false);
  });

  test("keeps hero content inside the page gutter", async ({ page }) => {
    await page.goto("/");

    // `.heroIn` is also a `.wrap`, and its `padding` shorthand zeroes the
    // wrap's inline padding — which put the headline hard against the glass.
    const heading = page.getByRole("heading", { level: 1 });
    const cta = page.getByRole("link", { name: /Create Something/ }).first();
    for (const target of [heading, cta]) {
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(16);
    }
  });

  test("never scrolls sideways", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(overflow.docWidth).toBeLessThanOrEqual(overflow.viewport + 1);
  });

  test("keeps the sign-in dialog usable in a short landscape viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/sign-in");

    const dialog = page.getByRole("dialog", {
      name: "Open beta coming soon!",
    });
    const close = page.getByRole("button", { name: "Close and return home" });
    await expect(dialog).toBeVisible();
    await expect(close).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(16);
    expect(box!.y + box!.height).toBeLessThanOrEqual(390 - 16);
  });
});
