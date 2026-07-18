import { describe, expect, it } from "vitest";
import {
  decodeMidiLibraryCursor,
  encodeMidiLibraryCursor,
  midiLibraryListingInputSchema,
  midiLibrarySearchParams,
  midiLibraryReuseCommandSchema,
  parseMidiLibraryFilters,
} from "./schema";

describe("MIDI library contracts", () => {
  it("normalizes the exact URL filter contract", () => {
    const parsed = parseMidiLibraryFilters({
      q: "  pulse  ",
      rights: "reference_only",
      family: "keys",
      tags: "rhythmic,dark,rhythmic",
      duration: "4-16",
      notes: "8-",
      pitch: "36-84",
      polyphony: "monophonic",
      sort: "name",
    });
    expect(parsed).toMatchObject({
      success: true,
      data: {
        query: "pulse",
        rights: "reference_only",
        family: "keys",
        tags: ["dark", "rhythmic"],
        duration: { min: 4, max: 16 },
        notes: { min: 8, max: null },
        pitch: { min: 36, max: 84 },
        sort: "name",
      },
    });
    if (parsed.success)
      expect(midiLibrarySearchParams(parsed.data).toString()).toContain(
        "rights=reference_only",
      );
    if (parsed.success)
      expect(midiLibrarySearchParams(parsed.data).toString()).toContain(
        "family=keys",
      );
  });
  it("rejects malformed filters and cursors before RPC input", () => {
    expect(parseMidiLibraryFilters({ rights: "maybe" }).success).toBe(false);
    expect(parseMidiLibraryFilters({ pitch: "90-20" }).success).toBe(false);
    expect(decodeMidiLibraryCursor("not-json")).toBeNull();
  });
  it("round trips a sort-bound cursor", () => {
    const encoded = encodeMidiLibraryCursor({
      version: 1,
      sort: "recent",
      filterHash: "abc",
      listingId: "10000000-0000-4000-8000-000000000001",
      listedAt: "2026-07-17T20:00:00.000Z",
      title: null,
    });
    expect(decodeMidiLibraryCursor(encoded)).toMatchObject({
      filterHash: "abc",
    });
  });
  it("blocks uncertain rights and requires compatible evidence", () => {
    expect(
      midiLibraryListingInputSchema.safeParse({ rightsBasis: "uncertain" })
        .success,
    ).toBe(false);
    const base = {
      patternVersionId: "10000000-0000-4000-8000-000000000001",
      requestId: "10000000-0000-4000-8000-000000000002",
      reuseMode: "reference_only",
      rightsBasis: "authorized_adaptation",
      attestationVersion: "midi-library-reference-display-attestation-v1",
      description: "",
      supportingSourceUrl: "https://example.test/source",
      supportingSourceTerms: "Permission",
      publicDomainRationale: null,
      categoryCode: "melody",
      suggestedPresetId: "warm-keys",
      suggestedPresetVersion: 1,
      tags: [],
      externalCredits: [{ creditedName: "Composer", role: "Composer" }],
      hasSourceLineage: false,
      hasInheritedExternalCredits: false,
      replaceListingId: null,
    };
    expect(midiLibraryListingInputSchema.safeParse(base).success).toBe(true);
    expect(
      midiLibraryListingInputSchema.safeParse({
        ...base,
        supportingSourceUrl: "http://example.test",
      }).success,
    ).toBe(false);
    expect(
      midiLibraryListingInputSchema.safeParse({
        ...base,
        hasSourceLineage: true,
        hasInheritedExternalCredits: true,
        externalCredits: [],
      }).success,
    ).toBe(true);
    expect(
      midiLibraryListingInputSchema.safeParse({
        ...base,
        hasSourceLineage: true,
        hasInheritedExternalCredits: true,
        rightsBasis: "original",
        supportingSourceUrl: null,
        supportingSourceTerms: null,
        externalCredits: [],
      }).success,
    ).toBe(false);
  });
  it("binds import and editor reuse to an optimistic workspace version", () => {
    const base = {
      listingId: "10000000-0000-4000-8000-000000000001",
      patternVersionId: "10000000-0000-4000-8000-000000000002",
      requestId: "10000000-0000-4000-8000-000000000003",
      operation: "import",
      workspaceId: "10000000-0000-4000-8000-000000000004",
      expectedWorkspaceLockVersion: 3,
      copyName: null,
      startTick: 0,
    };
    expect(midiLibraryReuseCommandSchema.safeParse(base).success).toBe(true);
    expect(
      midiLibraryReuseCommandSchema.safeParse({
        ...base,
        expectedWorkspaceLockVersion: null,
      }).success,
    ).toBe(false);
    expect(
      midiLibraryReuseCommandSchema.safeParse({
        ...base,
        operation: "open_editor",
        copyName: null,
      }).success,
    ).toBe(false);
  });
});
