import { describe, expect, it } from "vitest";
import {
  createAvatarThumbnailRenderer,
  escapeAvatarThumbnailXml,
} from "./thumbnails.client";

function decodeDataUri(uri: string) {
  return decodeURIComponent(uri.slice(uri.indexOf(",") + 1));
}

const definition = {
  components: {
    eyes: {
      width: 120.5,
      height: 48,
      variants: {
        variant01: {
          elements: [
            {
              type: "element",
              name: "path",
              attributes: { d: 'M0 0 & "quoted"', fill: "black" },
            },
          ],
        },
      },
    },
  },
};

describe("avatar part thumbnails", () => {
  it("looks up a variant, preserves its view box, and escapes XML attributes", () => {
    const renderer = createAvatarThumbnailRenderer(definition);
    const svg = decodeDataUri(renderer.get("eyes", "variant01"));

    expect(svg).toContain('viewBox="0 0 120.5 48"');
    expect(svg).toContain('d="M0 0 &amp; &quot;quoted&quot;"');
    expect(svg).not.toContain('& "quoted"');
  });

  it("escapes XML text safely", () => {
    expect(escapeAvatarThumbnailXml(`<tag a="x">Tom & 'Bea'</tag>`)).toBe(
      "&lt;tag a=&quot;x&quot;&gt;Tom &amp; &apos;Bea&apos;&lt;/tag&gt;",
    );
  });

  it("memoizes by component and variant", () => {
    const renderer = createAvatarThumbnailRenderer(definition);
    const first = renderer.get("eyes", "variant01");
    const second = renderer.get("eyes", "variant01");

    expect(second).toBe(first);
    expect(renderer.cacheSize()).toBe(1);
    renderer.get("eyes", "variant02");
    expect(renderer.cacheSize()).toBe(2);
  });

  it("keeps missing or malformed variants as numbered fallback tiles", () => {
    const renderer = createAvatarThumbnailRenderer({
      components: {
        mouth: {
          width: 100,
          height: 50,
          variants: {
            variant03: {
              elements: [
                {
                  type: "element",
                  name: "script",
                  attributes: { src: "https://example.test" },
                },
              ],
            },
          },
        },
      },
    });

    expect(decodeDataUri(renderer.get("mouth", "variant02"))).toContain(">M2<");
    expect(decodeDataUri(renderer.get("mouth", "variant03"))).toContain(">M3<");
  });
});
