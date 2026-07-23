import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicProject } from "./types";
import { DiscoveryProjectCard } from "./discovery-project-card";

vi.mock("@/features/public-midi/quick-preview-player.client", () => ({
  PublicMidiQuickPreview: ({ title }: { title: string }) => (
    <button type="button">Play {title}</button>
  ),
}));

const project: PublicProject = {
  projectId: "10000000-0000-4000-8000-000000000001",
  ownerId: "20000000-0000-4000-8000-000000000001",
  ownerUsername: "night-signal",
  ownerDisplayName: "Night Signal",
  title: "Windowlight Waltz",
  description: "A gentle sketch with room for a new melody.",
  bpm: 90,
  musicalKey: "g-major",
  timeSignature: { numerator: 3, denominator: 4 },
  license: {
    code: "cc-by-4.0",
    name: "CC BY 4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
    summary: "Attribution required.",
    allowsDerivatives: true,
  },
  openToContributions: true,
  currentRevisionId: "30000000-0000-4000-8000-000000000001",
  revisionNumber: 4,
  durationMs: 8_000,
  publishedAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
  genres: [
    {
      id: "40000000-0000-4000-8000-000000000001",
      slug: "ambient",
      name: "Ambient",
      isPrimary: true,
    },
  ],
  tags: [],
  tracks: [
    {
      id: "50000000-0000-4000-8000-000000000001",
      name: "Warm pad",
      sortOrder: 0,
      preset: { id: "warm-pad", version: 1 },
      clipCount: 1,
    },
    {
      id: "50000000-0000-4000-8000-000000000002",
      name: "Keys",
      sortOrder: 1,
      preset: { id: "warm-keys", version: 1 },
      clipCount: 1,
    },
  ],
  attributions: [],
  trendingScore: 0,
  discoveryVersion: 1,
};

describe("DiscoveryProjectCard", () => {
  it("keeps project, creator, preview, metadata, and primary navigation visible", () => {
    render(<DiscoveryProjectCard project={project} />);

    expect(
      screen.getByRole("link", { name: "Windowlight Waltz" }),
    ).toHaveAttribute("href", `/projects/${project.projectId}`);
    expect(screen.getByRole("link", { name: "@night-signal" })).toHaveAttribute(
      "href",
      "/@night-signal",
    );
    expect(
      screen.getByRole("button", { name: "Play Windowlight Waltz" }),
    ).toBeVisible();
    expect(screen.getByText("90 BPM")).toBeVisible();
    expect(screen.getByText("G")).toBeVisible();
    expect(screen.getByText("2 tracks")).toBeVisible();
    expect(screen.getByText("Rev 4")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open project" })).toHaveAttribute(
      "href",
      `/projects/${project.projectId}`,
    );
  });
});
