import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireViewer } from "@/features/auth/guards";
import type { SavedMidiPattern } from "@/features/midi-library/types";
import {
  listOwnedPrivateMidiWorkspaces,
  listSavedMidiLibraryPatterns,
} from "@/server/repositories/midi-library";
import SavedMidiPatternsPage from "./page";

vi.mock("@/features/auth/guards", () => ({ requireViewer: vi.fn() }));
vi.mock("@/server/repositories/midi-library", () => ({
  listSavedMidiLibraryPatterns: vi.fn(),
  listOwnedPrivateMidiWorkspaces: vi.fn(),
}));
vi.mock("@/features/midi-library/midi-library-preview.client", () => ({
  MidiLibraryPreview: ({ title }: { title: string }) => (
    <div data-testid="preview">{title}</div>
  ),
}));
vi.mock("@/features/midi-library/reuse-controls.client", () => ({
  MidiLibraryReuseControls: () => <div data-testid="reuse-controls" />,
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
  }: ComponentProps<"a"> & { prefetch?: unknown }) => (
    <a
      {...props}
      data-prefetch={
        prefetch === false
          ? "false"
          : prefetch === null
            ? "default"
            : "unspecified"
      }
    />
  ),
}));

const pattern: SavedMidiPattern = {
  midiPatternVersionId: "11111111-1111-4111-8111-111111111111",
  sourceListingId: "22222222-2222-4222-8222-222222222222",
  title: "Lead motif",
  creatorUsername: "nova",
  creatorDisplayName: "Nova",
  creatorCreditName: "Nova",
  reuseMode: "commercial_reuse",
  license: { code: "CC-BY-4.0", version: "4.0", url: "https://example.test" },
  categoryName: "Melody",
  preset: { id: "soft-lead", version: 1, name: "Soft lead" },
  durationTicks: 1920,
  noteCount: 32,
  savedAt: "2026-07-19T12:00:00.000Z",
  sourceAvailability: "active",
  canReuse: true,
  externalCredits: [],
  notes: [],
};

afterEach(cleanup);

describe("saved clips page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireViewer).mockResolvedValue({ id: "viewer" } as never);
    vi.mocked(listOwnedPrivateMidiWorkspaces).mockResolvedValue([]);
  });

  it("renders a card per saved clip with its version identity intact", async () => {
    vi.mocked(listSavedMidiLibraryPatterns).mockResolvedValue([pattern]);
    render(await SavedMidiPatternsPage());

    const card = screen.getByRole("article");
    expect(
      within(card).getByRole("link", { name: "Lead motif" }),
    ).toHaveAttribute("href", `/library/${pattern.sourceListingId}`);
    expect(within(card).getByRole("link", { name: "@nova" })).toHaveAttribute(
      "href",
      "/@nova",
    );
    expect(within(card).getByText("CC BY 4.0")).toBeInTheDocument();
    expect(within(card).getByText("4 beats")).toBeInTheDocument();
    expect(within(card).getByText("32 notes")).toBeInTheDocument();
    // The exact immutable version is the point of a saved clip; it stays
    // reachable without printing a UUID across the card.
    expect(within(card).getByTitle(/Pattern version/)).toHaveTextContent(
      "Exact version",
    );
    expect(within(card).getByTestId("reuse-controls")).toBeInTheDocument();
  });

  it("explains when the source listing is no longer active", async () => {
    vi.mocked(listSavedMidiLibraryPatterns).mockResolvedValue([
      { ...pattern, sourceAvailability: "unavailable" },
    ]);
    render(await SavedMidiPatternsPage());

    expect(
      screen.getByText(/no longer available. Your saved version still plays/i),
    ).toBeInTheDocument();
  });

  it("offers a way back to the library when nothing is saved", async () => {
    vi.mocked(listSavedMidiLibraryPatterns).mockResolvedValue([]);
    render(await SavedMidiPatternsPage());

    expect(screen.queryByRole("article")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Find reusable MIDI" }),
    ).toHaveAttribute("href", "/library?rights=commercial_reuse");
  });

  it("keeps saved-clip destinations cold before intent", async () => {
    vi.mocked(listSavedMidiLibraryPatterns).mockResolvedValue([pattern]);
    render(await SavedMidiPatternsPage());

    expect(
      screen
        .getAllByRole("link")
        .every((link) => link.getAttribute("data-prefetch") === "false"),
    ).toBe(true);
  });
});
