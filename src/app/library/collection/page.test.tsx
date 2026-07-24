import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireViewer } from "@/features/auth/guards";
import { listOwnedPrivateMidiWorkspaces } from "@/server/repositories/midi-library";
import { listStudioClipCollection } from "@/server/repositories/studio-clip-collection";
import ClipCollectionPage from "./page";

vi.mock("@/features/auth/guards", () => ({ requireViewer: vi.fn() }));
vi.mock("@/server/repositories/studio-clip-collection", () => ({
  listStudioClipCollection: vi.fn(),
}));
vi.mock("@/server/repositories/midi-library", () => ({
  listOwnedPrivateMidiWorkspaces: vi.fn(),
}));
vi.mock("@/features/clip-collection/collection-grid.client", () => ({
  ClipCollectionGrid: ({
    items,
    selectedSource,
  }: {
    items: Array<{ patternVersionId: string; patternName: string }>;
    selectedSource: string;
  }) => (
    <div data-testid="collection-grid" data-source={selectedSource}>
      {items.map((item) => (
        <article key={item.patternVersionId}>{item.patternName}</article>
      ))}
    </div>
  ),
}));
vi.mock("@/components/ui/reveal.client", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: unknown }) => {
    void prefetch;
    return <a {...props} />;
  },
}));

const owned = {
  patternId: "11111111-1111-4111-8111-111111111111",
  patternVersionId: "22222222-2222-4222-8222-222222222222",
  patternName: "Latest owned phrase",
  versionNumber: 8,
  creatorId: "33333333-3333-4333-8333-333333333333",
  creatorCreditName: "Clip Artist",
  durationTicks: 1920,
  noteCount: 4,
  createdAt: "2026-07-24T12:00:00.000Z",
  hasLineage: true,
  versionCount: 8,
  source: "owned" as const,
  isOwned: true,
  isSaved: false,
  availability: "available" as const,
  canImport: true,
  preset: { id: "warm-keys", version: 1, name: "Warm keys" },
};

afterEach(cleanup);

describe("clip collection page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireViewer).mockResolvedValue({ id: "viewer" } as never);
    vi.mocked(listStudioClipCollection).mockResolvedValue({ items: [owned] });
    vi.mocked(listOwnedPrivateMidiWorkspaces).mockResolvedValue([]);
  });

  it("defaults to My clips and fetches only the owned source", async () => {
    render(
      await ClipCollectionPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(requireViewer).toHaveBeenCalledWith(
      "/library/collection?source=owned",
    );
    expect(listStudioClipCollection).toHaveBeenCalledWith({
      source: "owned",
      query: null,
      limit: 100,
    });
    expect(listOwnedPrivateMidiWorkspaces).not.toHaveBeenCalled();
    expect(screen.getByTestId("collection-grid")).toHaveAttribute(
      "data-source",
      "owned",
    );
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Latest owned phrase")).toBeInTheDocument();
  });

  it("fetches saved metadata and workspace choices only for Saved clips", async () => {
    render(
      await ClipCollectionPage({
        searchParams: Promise.resolve({ source: "saved", q: " bass " }),
      }),
    );

    expect(requireViewer).toHaveBeenCalledWith(
      "/library/collection?source=saved&q=bass",
    );
    expect(listStudioClipCollection).toHaveBeenCalledWith({
      source: "saved",
      query: "bass",
      limit: 100,
    });
    expect(listOwnedPrivateMidiWorkspaces).toHaveBeenCalledOnce();
  });

  it("does not issue a collection read for an overlong query", async () => {
    render(
      await ClipCollectionPage({
        searchParams: Promise.resolve({ q: "x".repeat(81) }),
      }),
    );

    expect(listStudioClipCollection).not.toHaveBeenCalled();
    expect(screen.getByText(/80 characters or fewer/i)).toBeInTheDocument();
  });

  it("uses source-specific empty and search-empty language", async () => {
    vi.mocked(listStudioClipCollection).mockResolvedValue({ items: [] });
    const { rerender } = render(
      await ClipCollectionPage({
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByText("No clips made yet.")).toBeInTheDocument();

    rerender(
      await ClipCollectionPage({
        searchParams: Promise.resolve({ source: "saved", q: "lead" }),
      }),
    );
    expect(
      screen.getByText("No saved clips match that search."),
    ).toBeInTheDocument();
  });
});
