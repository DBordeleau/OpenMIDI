import { describe, expect, it } from "vitest";
import { clipCollectionHref, parseClipCollectionSearch } from "./search";

describe("clip collection URL state", () => {
  it("defaults to owned and normalizes a bounded query", () => {
    expect(parseClipCollectionSearch({})).toEqual({
      source: "owned",
      query: null,
      error: null,
    });
    expect(
      parseClipCollectionSearch({ source: "saved", q: "  bass line  " }),
    ).toEqual({
      source: "saved",
      query: "bass line",
      error: null,
    });
  });

  it("rejects overlong or repeated query input without widening the read", () => {
    expect(parseClipCollectionSearch({ q: "x".repeat(81) }).error).toMatch(
      /80 characters/,
    );
    expect(parseClipCollectionSearch({ q: ["lead", "bass"] }).error).toMatch(
      /80 characters/,
    );
  });

  it("builds canonical source and search links", () => {
    expect(clipCollectionHref("owned", null)).toBe(
      "/library/collection?source=owned",
    );
    expect(clipCollectionHref("saved", "soft lead")).toBe(
      "/library/collection?source=saved&q=soft+lead",
    );
  });
});
