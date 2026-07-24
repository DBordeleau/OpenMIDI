import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AVATAR_OPTIONS } from "@/features/profiles/avatar/contract";
import type { PublicRevisionHistoryItem } from "@/server/repositories/public-midi";
import type { PublicProjectDetail } from "@/server/repositories/public-projects";
import { PublicProjectPage, SemanticHistory } from "./public-project-page";

vi.mock("@/components/ui/reveal.client", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/features/projects/arrangement-map.client", () => ({
  ArrangementMap: () => <div>Arrangement map</div>,
}));
vi.mock("@/features/public-midi/quick-preview-player.client", () => ({
  PublicMidiQuickPreview: () => <div>Preview player</div>,
}));

const generatedConfig = {
  version: 1,
  seed: "30000000-0000-4000-8000-000000000001",
  options: DEFAULT_AVATAR_OPTIONS,
};

const project = {
  projectId: "30000000-0000-4000-8000-000000000010",
  ownerId: "30000000-0000-4000-8000-000000000001",
  ownerUsername: "Ada",
  ownerDisplayName: "Ada Beat",
  ownerAvatarConfig: generatedConfig,
  title: "Public pocket",
  description: null,
  bpm: 120,
  musicalKey: "c-major",
  timeSignature: { numerator: 4, denominator: 4 },
  license: {
    code: "cc-by-4.0",
    name: "CC BY 4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
    summary: "Reuse with attribution.",
    allowsDerivatives: true,
  },
  openToContributions: false,
  currentRevisionId: "30000000-0000-4000-8000-000000000011",
  revisionNumber: 1,
  durationMs: 4_000,
  publishedAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z",
  genres: [],
  tags: [],
  tracks: [],
  arrangementTracks: [],
  patternSilhouettes: new Map(),
  attributions: [
    {
      kind: "publisher",
      creditName: "Ada Beat",
      profileId: "30000000-0000-4000-8000-000000000001",
      profileUsername: "Ada",
      avatarConfig: generatedConfig,
    },
    {
      kind: "accepted_contributor",
      creditName: "No Config",
      profileId: "30000000-0000-4000-8000-000000000002",
      profileUsername: null,
      avatarConfig: null,
    },
  ],
  trendingScore: 1,
  discoveryVersion: 1,
} satisfies PublicProjectDetail;

describe("public project detail presentation", () => {
  it("uses configured local avatars and initials fallback for detail credits", async () => {
    const { container } = render(
      <PublicProjectPage
        project={project}
        lineage={{
          source: null,
          sourceUnavailable: false,
          directForks: [],
          hasMoreDirectForks: false,
        }}
        history={[]}
        canCollaborate={false}
      />,
    );

    await waitFor(() =>
      expect(
        container.querySelectorAll("[data-avatar-fingerprint]"),
      ).toHaveLength(2),
    );
    const fallbackCredit = screen.getByText("No Config").closest("li");
    expect(
      fallbackCredit?.querySelector("[aria-hidden='true']"),
    ).toHaveTextContent("N");
  });

  it("shows readable exact lineage and never renders pattern UUIDs", () => {
    const patternVersionId = "30000000-0000-4000-8000-000000000012";
    const history = [
      {
        id: "30000000-0000-4000-8000-000000000013",
        revisionNumber: 1,
        parentRevisionId: null,
        message: "First take",
        createdAt: "2026-07-22T00:00:00.000Z",
        durationMs: 4_000,
        publisher: { creditName: "Ada Beat" },
        acceptedContributor: null,
        summary: ["Started with one pattern."],
        algorithmVersion: null,
        patternLineage: [
          {
            midiPatternVersionId: patternVersionId,
            patternName: "Readable pulse",
            creatorCreditName: "Ada Beat",
            parentMidiPatternVersionId: null,
            sourceMidiPatternVersionId: null,
          },
          {
            midiPatternVersionId: "30000000-0000-4000-8000-000000000014",
            patternName: null,
            creatorCreditName: "Missing Musician",
            parentMidiPatternVersionId: null,
            sourceMidiPatternVersionId: null,
          },
        ],
      },
    ] satisfies PublicRevisionHistoryItem[];

    render(<SemanticHistory projectId={project.projectId} history={history} />);

    fireEvent.click(screen.getByText("Exact pattern lineage"));
    expect(screen.getByText("Readable pulse")).toBeVisible();
    expect(screen.getByText("Unavailable pattern")).toBeVisible();
    expect(screen.getByText("Created by Ada Beat")).toBeVisible();
    expect(screen.getByText("Created by Missing Musician")).toBeVisible();
    expect(screen.queryByText(patternVersionId)).not.toBeInTheDocument();
  });
});
