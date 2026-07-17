import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "next/navigation";
import {
  getPublicMidiLibraryListing,
  getPublicMidiLibraryPatternComparison,
} from "@/server/repositories/midi-library";
import MidiLibraryDetailPage from "./page";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/server/repositories/midi-library", () => ({
  getPublicMidiLibraryListing: vi.fn(),
  getPublicMidiLibraryPatternComparison: vi.fn(),
}));
vi.mock("@/features/midi-library/midi-library-preview.client", () => ({
  MidiLibraryPreview: () => <div>Deterministic local preview</div>,
}));
vi.mock("@/features/midi-library/read-only-piano-roll", () => ({
  MidiLibraryReadOnlyPianoRoll: () => <div>Exact read-only notes</div>,
}));
vi.mock("@/features/midi-library/pattern-version-comparison.client", () => ({
  MidiLibraryPatternComparisonView: () => <div>Shared pattern DIFF</div>,
}));
vi.mock("@/features/midi-library/report-form.client", () => ({
  MidiLibraryReportForm: () => (
    <div>Report unoriginal or unauthorized work</div>
  ),
}));

const listingId = "30000000-0000-4000-8000-000000000001";
const patternId = "30000000-0000-4000-8000-000000000002";
const versionId = "30000000-0000-4000-8000-000000000003";
const detail = {
  listing: {
    listingId,
    midiPatternId: patternId,
    midiPatternVersionId: versionId,
    title: "Rights phrase",
    description: "Inspectable phrase",
    ownerId: "30000000-0000-4000-8000-000000000004",
    creatorUsername: "creator",
    creatorDisplayName: "Creator",
    creatorCreditName: "Creator credit",
    reuseMode: "reference_only",
    rightsBasis: "authorized_adaptation",
    attestationVersion: "midi-library-reference-display-attestation-v1",
    attestedAt: "2026-07-17T20:00:00.000Z",
    supportingSourceUrl: "https://example.test/source",
    supportingSourceTerms: "Display permission",
    publicDomainRationale: null,
    category: { code: "melody", name: "Melody" },
    preset: { id: "soft-lead", version: 1, name: "Soft lead", family: "leads" },
    tags: [],
    durationTicks: 960,
    durationBeats: 2,
    noteCount: 1,
    minPitch: 60,
    maxPitch: 60,
    polyphony: "monophonic",
    listedAt: "2026-07-17T20:00:00.000Z",
    notes: [
      {
        noteId: "30000000-0000-4000-8000-000000000005",
        startTick: 0,
        durationTicks: 240,
        pitch: 60,
        velocity: 90,
      },
    ],
    externalCredits: [
      {
        creditedName: "External Composer",
        role: "Composer",
        sourceUrl: "https://example.test/source",
      },
    ],
  },
  platformLineage: {
    patternId,
    sourceCreatorCreditName: "OpenMIDI Source Creator",
  },
  history: [
    {
      midiPatternVersionId: versionId,
      midiPatternId: patternId,
      versionNumber: 1,
      creatorId: "30000000-0000-4000-8000-000000000004",
      creatorCreditName: "Creator credit",
      parentMidiPatternVersionId: null,
      sourceMidiPatternVersionId: null,
      ppq: 480,
      durationTicks: 960,
      noteCount: 1,
      contentSha256: "a".repeat(64),
      reuseLicenseCode: null,
      reuseLicenseVersion: null,
      reuseLicenseUrl: null,
      createdAt: "2026-07-17T20:00:00.000Z",
      notes: [],
    },
  ],
  usage: {
    publicProjectCount: 1,
    projects: [
      {
        projectId: "30000000-0000-4000-8000-000000000006",
        title: "Public project only",
        revisionId: "30000000-0000-4000-8000-000000000007",
        revisionNumber: 2,
        publishedAt: "2026-07-17T20:00:00.000Z",
      },
    ],
  },
} as const;

describe("library detail route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("presents exact rights, separate credits and lineage, public usage, reporting, and shared diff", async () => {
    vi.mocked(getPublicMidiLibraryListing).mockResolvedValue(detail as never);
    vi.mocked(getPublicMidiLibraryPatternComparison).mockResolvedValue({
      listingId,
      from: detail.history[0],
      to: detail.history[0],
    } as never);
    render(
      await MidiLibraryDetailPage({
        params: Promise.resolve({ listingId }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getAllByText("Reference only — reuse not granted").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("External Composer")).toBeVisible();
    expect(screen.getByText("OpenMIDI Source Creator")).toBeVisible();
    expect(screen.getByText("Public project only")).toBeVisible();
    expect(screen.getByText("Shared pattern DIFF")).toBeVisible();
    expect(
      screen.getByText("Report unoriginal or unauthorized work"),
    ).toBeVisible();
  });

  it("uses a non-leaking not-found state for hidden or unlisted detail", async () => {
    vi.mocked(getPublicMidiLibraryListing).mockResolvedValue(null);
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    await expect(
      MidiLibraryDetailPage({
        params: Promise.resolve({ listingId }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
