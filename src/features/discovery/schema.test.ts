import { describe, expect, it } from "vitest";
import {
  decodeDiscoveryCursor,
  discoverySearchParams,
  encodeDiscoveryCursor,
  filterFingerprint,
  parseDiscoveryFilters,
} from "./schema";

describe("discovery URL contract", () => {
  it("normalizes repeated filters into a canonical bounded shape", () => {
    const parsed = parseDiscoveryFilters({
      q: "  midnight  ",
      genre: ["rock", "electronic", "rock"],
      key: "c-minor",
      bpmMin: "90",
      open: "1",
      sort: "trending",
    });
    expect(parsed).toEqual({
      success: true,
      data: {
        query: "midnight",
        genres: ["electronic", "rock"],
        tags: [],
        instruments: [],
        keys: ["c-minor"],
        bpmMin: 90,
        bpmMax: null,
        openOnly: true,
        sort: "trending",
        after: null,
      },
    });
    if (parsed.success)
      expect(discoverySearchParams(parsed.data).toString()).toBe(
        "q=midnight&genre=electronic&genre=rock&key=c-minor&bpmMin=90&open=1&sort=trending",
      );
  });
  it("rejects invalid bounds and duplicate scalar parameters", () => {
    expect(parseDiscoveryFilters({ bpmMin: "150", bpmMax: "90" }).success).toBe(
      false,
    );
    expect(
      parseDiscoveryFilters({ sort: ["recent", "trending"] }).success,
    ).toBe(false);
  });
  it("round trips a versioned filter-bound cursor", () => {
    const filterHash = filterFingerprint({
      query: "midnight",
      genres: [],
      tags: [],
      instruments: [],
      keys: [],
      bpmMin: null,
      bpmMax: null,
      openOnly: false,
      sort: "recent",
    });
    const encoded = encodeDiscoveryCursor({
      version: 1,
      sort: "recent",
      filterHash,
      discoveryVersion: 9,
      projectId: "10000000-0000-4000-8000-000000000001",
      publishedAt: "2026-07-13T20:00:00.000Z",
      score: null,
    });
    expect(decodeDiscoveryCursor(encoded)).toMatchObject({ filterHash });
    expect(decodeDiscoveryCursor("not-json")).toBeNull();
  });
});
