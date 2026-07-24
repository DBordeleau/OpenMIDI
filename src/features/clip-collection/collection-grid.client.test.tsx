import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps, ElementType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioClipDetailAction } from "@/features/studio/clip-collection/actions";
import type {
  StudioClipCollection,
  StudioClipDetail,
} from "@/features/studio/clip-collection/schema";
import { ClipCollectionGrid } from "./collection-grid.client";

vi.mock("@/features/studio/clip-collection/actions", () => ({
  getStudioClipDetailAction: vi.fn(),
}));
vi.mock("@/features/midi-library/midi-library-preview.client", () => ({
  MidiLibraryPreview: ({
    title,
    notes,
  }: {
    title: string;
    notes: unknown[];
  }) => (
    <div data-testid="library-preview" data-preview-title={title}>
      {notes.length} notes visible before playback
    </div>
  ),
}));
vi.mock("@/features/midi-library/reuse-controls.client", () => ({
  MidiLibraryReuseControls: ({ canReuse }: { canReuse: boolean }) => (
    <div data-testid="reuse-controls" data-can-reuse={String(canReuse)} />
  ),
}));
vi.mock("@/components/ui/reveal.client", () => ({
  Reveal: ({
    as,
    children,
    ...props
  }: {
    as?: ElementType;
    children: ReactNode;
    delay?: number;
  }) => {
    const Component = as ?? "div";
    const { delay, ...safeProps } = props;
    void delay;
    return <Component {...safeProps}>{children}</Component>;
  },
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

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;

function item(
  suffix: string,
  patch: Partial<StudioClipCollection["items"][number]> = {},
): StudioClipCollection["items"][number] {
  return {
    patternId: id(`1000000000${suffix}`),
    patternVersionId: id(`2000000000${suffix}`),
    patternName: `Phrase ${suffix}`,
    versionNumber: 2,
    creatorId: id(`3000000000${suffix}`),
    creatorCreditName: "Clip Artist",
    durationTicks: 960,
    noteCount: 1,
    createdAt: "2026-07-24T12:00:00.000Z",
    hasLineage: true,
    versionCount: 2,
    source: "owned",
    isOwned: true,
    isSaved: false,
    availability: "available",
    canImport: true,
    preset: { id: "warm-keys", version: 1, name: "Warm keys" },
    ...patch,
  };
}

function detail(metadata: StudioClipCollection["items"][number]) {
  return {
    metadata,
    externalCredits: [],
    pattern: {
      midiPatternVersionId: metadata.patternVersionId,
      midiPatternId: metadata.patternId,
      version: metadata.versionNumber,
      creatorId: metadata.creatorId,
      creatorCreditName: metadata.creatorCreditName,
      parentMidiPatternVersionId: null,
      sourceMidiPatternVersionId: null,
      contentSha256: "a".repeat(64),
      noteCount: 1,
      ppq: 480,
      durationTicks: metadata.durationTicks,
      reuseLicense: null,
      createdAt: metadata.createdAt,
      notes: [
        {
          noteId: id("900000000001"),
          startTick: 0,
          durationTicks: 480,
          pitch: 60,
          velocity: 100,
        },
      ],
      name: metadata.patternName,
      presetId: metadata.preset!.id,
      presetVersion: metadata.preset!.version,
    },
  } satisfies StudioClipDetail;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("clip collection grid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IntersectionObserver", undefined);
  });

  it("loads visible detail and reuses the library note-roll preview before playback", async () => {
    const owned = item("01");
    vi.mocked(getStudioClipDetailAction).mockResolvedValue({
      ok: true,
      detail: detail(owned),
    });

    render(
      <ClipCollectionGrid
        items={[owned]}
        selectedSource="owned"
        workspaces={[]}
      />,
    );

    expect(await screen.findByTestId("library-preview")).toHaveTextContent(
      "1 notes visible before playback",
    );
    expect(screen.getByTestId("library-preview")).toHaveAttribute(
      "data-preview-title",
      owned.patternName,
    );
    expect(getStudioClipDetailAction).toHaveBeenCalledOnce();
  });

  it("waits until a card approaches the viewport before loading its notes", async () => {
    const owned = item("01");
    let onIntersection:
      ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(
          callback: (entries: Array<{ isIntersecting: boolean }>) => void,
          options?: { rootMargin?: string },
        ) {
          onIntersection = callback;
          expect(options?.rootMargin).toBe("240px 0px");
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    vi.mocked(getStudioClipDetailAction).mockResolvedValue({
      ok: true,
      detail: detail(owned),
    });

    render(
      <ClipCollectionGrid
        items={[owned]}
        selectedSource="owned"
        workspaces={[]}
      />,
    );

    expect(observe).toHaveBeenCalledOnce();
    expect(getStudioClipDetailAction).not.toHaveBeenCalled();

    await act(async () => {
      onIntersection?.([{ isIntersecting: true }]);
    });

    expect(await screen.findByTestId("library-preview")).toBeInTheDocument();
    expect(disconnect).toHaveBeenCalled();
  });

  it("does not re-arm automatic loading after failures and retries only on request", async () => {
    const owned = item("01");
    const callbacks: Array<
      (entries: Array<{ isIntersecting: boolean }>) => void
    > = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(
          callback: (entries: Array<{ isIntersecting: boolean }>) => void,
        ) {
          callbacks.push(callback);
        }
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    vi.mocked(getStudioClipDetailAction).mockResolvedValue({
      ok: false,
      code: "source_unavailable",
    });

    render(
      <ClipCollectionGrid
        items={[owned]}
        selectedSource="owned"
        workspaces={[]}
      />,
    );

    expect(callbacks).toHaveLength(1);
    await act(async () => {
      callbacks[0]?.([{ isIntersecting: true }]);
    });

    const firstRetry = await screen.findByRole("button", {
      name: "Retry preview",
    });
    expect(getStudioClipDetailAction).toHaveBeenCalledOnce();
    expect(callbacks).toHaveLength(1);

    fireEvent.click(firstRetry);
    await waitFor(() =>
      expect(getStudioClipDetailAction).toHaveBeenCalledTimes(2),
    );
    const secondRetry = await screen.findByRole("button", {
      name: "Retry preview",
    });
    expect(callbacks).toHaveLength(1);

    fireEvent.click(secondRetry);
    await waitFor(() =>
      expect(getStudioClipDetailAction).toHaveBeenCalledTimes(3),
    );
    expect(callbacks).toHaveLength(1);
  });

  it("ignores stale detail after the collection changes", async () => {
    const first = item("01");
    const second = item("02");
    let resolveFirst:
      | ((value: Awaited<ReturnType<typeof getStudioClipDetailAction>>) => void)
      | undefined;
    const firstResponse = new Promise<
      Awaited<ReturnType<typeof getStudioClipDetailAction>>
    >((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(getStudioClipDetailAction)
      .mockReturnValueOnce(firstResponse)
      .mockResolvedValueOnce({ ok: true, detail: detail(second) });

    const view = render(
      <ClipCollectionGrid
        items={[first]}
        selectedSource="owned"
        workspaces={[]}
      />,
    );
    view.rerender(
      <ClipCollectionGrid
        items={[second]}
        selectedSource="owned"
        workspaces={[]}
      />,
    );

    expect(await screen.findByTestId("library-preview")).toHaveAttribute(
      "data-preview-title",
      second.patternName,
    );

    await act(async () => {
      resolveFirst?.({ ok: true, detail: detail(first) });
    });
    expect(screen.getByTestId("library-preview")).toHaveAttribute(
      "data-preview-title",
      second.patternName,
    );
  });

  it("keeps an unavailable saved bookmark visible without loading private notes", () => {
    const saved = item("03", {
      source: "saved",
      isOwned: false,
      isSaved: true,
      versionCount: undefined,
      savedListingId: id("400000000003"),
      savedAt: "2026-07-24T12:01:00.000Z",
      savedAvailability: "moderation_hidden",
      savedCanImport: false,
      availability: "moderation_hidden",
      canImport: false,
      reuseLicense: {
        code: "CC-BY-4.0",
        version: "4.0",
        url: "https://creativecommons.org/licenses/by/4.0/",
      },
    });

    render(
      <ClipCollectionGrid
        items={[saved]}
        selectedSource="saved"
        workspaces={[]}
      />,
    );

    expect(screen.queryByTestId("library-preview")).toBeNull();
    expect(screen.getAllByText(/under review/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("reuse-controls")).toHaveAttribute(
      "data-can-reuse",
      "false",
    );
    expect(getStudioClipDetailAction).not.toHaveBeenCalled();
  });
});
