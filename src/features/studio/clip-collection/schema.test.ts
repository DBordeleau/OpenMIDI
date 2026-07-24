import { describe, expect, it } from "vitest";
import {
  importStudioClipInputSchema,
  studioClipCollectionSchema,
  studioClipDetailSchema,
} from "./schema";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;

const unavailableSaved = {
  patternId: id("000000000001"),
  patternVersionId: id("000000000002"),
  patternName: "Saved phrase",
  versionNumber: 1,
  creatorId: id("000000000003"),
  creatorCreditName: "Producer",
  durationTicks: 960,
  noteCount: 1,
  createdAt: "2026-07-24T12:00:00.000Z",
  hasLineage: false,
  source: "saved",
  isOwned: false,
  isSaved: true,
  savedListingId: id("000000000004"),
  savedAt: "2026-07-24T12:01:00.000Z",
  savedAvailability: "moderation_hidden",
  savedCanImport: false,
  availability: "moderation_hidden",
  canImport: false,
  preset: { id: "warm-keys", version: 1, name: "Warm keys" },
  reuseLicense: {
    code: "CC-BY-4.0",
    version: "4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
  },
} as const;

describe("Studio clip collection schemas", () => {
  it("accepts unavailable saved metadata without returning MIDI notes", () => {
    expect(
      studioClipDetailSchema.parse({
        metadata: unavailableSaved,
        externalCredits: [],
        pattern: null,
      }),
    ).toMatchObject({ pattern: null });
  });

  it("rejects note arrays smuggled into the bounded collection projection", () => {
    expect(() =>
      studioClipCollectionSchema.parse({
        items: [{ ...unavailableSaved, notes: [] }],
      }),
    ).toThrow();
  });

  it("requires complete saved provenance metadata", () => {
    const incomplete = { ...unavailableSaved, savedAt: undefined };
    expect(() =>
      studioClipCollectionSchema.parse({ items: [incomplete] }),
    ).toThrow();
  });

  it("bounds collection length and exact import inputs", () => {
    expect(() =>
      studioClipCollectionSchema.parse({
        items: Array.from({ length: 101 }, () => unavailableSaved),
      }),
    ).toThrow();
    expect(() =>
      importStudioClipInputSchema.parse({
        patternVersionId: id("000000000002"),
        source: "saved",
        workspaceId: id("000000000005"),
        requestId: id("000000000006"),
        expectedWorkspaceLockVersion: 1,
        startTick: -1,
      }),
    ).toThrow();
  });
});
