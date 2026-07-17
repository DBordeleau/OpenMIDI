import { describe, expect, it } from "vitest";
import {
  mapMidiLibraryDetail,
  mapMidiLibraryPatternComparison,
} from "./detail";

const ids = {
  listing: "10000000-0000-4000-8000-000000000001",
  pattern: "10000000-0000-4000-8000-000000000002",
  version: "10000000-0000-4000-8000-000000000003",
  owner: "10000000-0000-4000-8000-000000000004",
  note: "10000000-0000-4000-8000-000000000005",
  project: "10000000-0000-4000-8000-000000000006",
  revision: "10000000-0000-4000-8000-000000000007",
};
const history = {
  midiPatternVersionId: ids.version,
  midiPatternId: ids.pattern,
  versionNumber: 1,
  creatorId: ids.owner,
  creatorCreditName: "Pattern Creator",
  parentMidiPatternVersionId: null,
  sourceMidiPatternVersionId: null,
  ppq: 480,
  durationTicks: 960,
  noteCount: 1,
  contentSha256: "a".repeat(64),
  reuseLicenseCode: "CC-BY-4.0",
  reuseLicenseVersion: "4.0",
  reuseLicenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  createdAt: "2026-07-17T20:00:00.000Z",
  notes: [
    {
      noteId: ids.note,
      startTick: 0,
      durationTicks: 240,
      pitch: 60,
      velocity: 90,
    },
  ],
};
const detail = {
  listing: {
    listingId: ids.listing,
    midiPatternId: ids.pattern,
    midiPatternVersionId: ids.version,
    title: "Exact phrase",
    description: "A useful phrase",
    ownerId: ids.owner,
    creatorUsername: "creator",
    creatorDisplayName: "Creator",
    creatorCreditName: "Pattern Creator",
    reuseMode: "commercial_reuse",
    rightsBasis: "authorized_adaptation",
    attestationVersion: "midi-library-commercial-attestation-v1",
    attestedAt: "2026-07-17T20:00:00.000Z",
    supportingSourceUrl: "https://example.test/source",
    supportingSourceTerms: "Compatible terms",
    publicDomainRationale: null,
    category: { code: "melody", name: "Melody" },
    preset: { id: "soft-lead", version: 1, name: "Soft lead", family: "leads" },
    durationTicks: 960,
    durationBeats: 2,
    noteCount: 1,
    minPitch: 60,
    maxPitch: 60,
    polyphony: "monophonic",
    listedAt: "2026-07-17T20:00:00.000Z",
    tags: [{ code: "melodic", name: "Melodic" }],
    externalCredits: [{ creditedName: "External Composer", role: "Composer" }],
    notes: history.notes,
  },
  platformLineage: { patternId: ids.pattern },
  history: [history],
  usage: {
    publicProjectCount: 1,
    projects: [
      {
        projectId: ids.project,
        title: "Public song",
        revisionId: ids.revision,
        revisionNumber: 1,
        publishedAt: "2026-07-17T20:00:00.000Z",
      },
    ],
  },
};

describe("library detail mapping", () => {
  it("preserves exact identity, rights, separate credits, history, and public usage", () => {
    const mapped = mapMidiLibraryDetail(detail);
    expect(mapped.listing.midiPatternVersionId).toBe(ids.version);
    expect(mapped.listing.externalCredits[0]?.creditedName).toBe(
      "External Composer",
    );
    expect(mapped.platformLineage.patternId).toBe(ids.pattern);
    expect(mapped.history).toHaveLength(1);
    expect(mapped.usage.publicProjectCount).toBe(1);
  });

  it("rejects a history row from another pattern", () => {
    expect(() =>
      mapMidiLibraryDetail({
        ...detail,
        history: [{ ...history, midiPatternId: ids.project }],
      }),
    ).toThrow("midi_library_detail_pattern_mismatch");
  });

  it("enforces same-pattern comparison mapping", () => {
    expect(() =>
      mapMidiLibraryPatternComparison({
        listingId: ids.listing,
        from: history,
        to: { ...history, midiPatternId: ids.project },
      }),
    ).toThrow("midi_library_comparison_pattern_mismatch");
  });
});
