import {
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

const runtime = vi.hoisted(() => ({
  prepare: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("@/features/studio/clip-collection/actions", () => ({
  getStudioClipDetailAction: vi.fn(),
}));
vi.mock("@/features/public-midi/preview-runtime.client", () => ({
  PublicMidiPreviewRuntime: class {
    prepare = runtime.prepare;
    play = runtime.play;
    pause = runtime.pause;
    dispose = runtime.dispose;
  },
}));
vi.mock("@/features/midi-library/pattern-roll", () => ({
  PatternRoll: ({ notes }: { notes: unknown[] }) => (
    <div data-testid="pattern-roll">{notes.length} notes loaded</div>
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

afterEach(cleanup);

describe("clip collection grid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.prepare.mockResolvedValue(undefined);
    runtime.play.mockResolvedValue(undefined);
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("does not load notes until Preview is deliberately pressed", async () => {
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

    expect(getStudioClipDetailAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pattern-roll")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: `Preview ${owned.patternName}` }),
    );
    expect(await screen.findByTestId("pattern-roll")).toHaveTextContent(
      "1 notes loaded",
    );
    expect(getStudioClipDetailAction).toHaveBeenCalledOnce();
    expect(runtime.play).toHaveBeenCalledOnce();
  });

  it("keeps playback exclusive while moving between cards", async () => {
    const first = item("01");
    const second = item("02");
    vi.mocked(getStudioClipDetailAction).mockImplementation(async () => ({
      ok: true,
      detail:
        vi.mocked(getStudioClipDetailAction).mock.calls.length === 1
          ? detail(first)
          : detail(second),
    }));
    render(
      <ClipCollectionGrid
        items={[first, second]}
        selectedSource="owned"
        workspaces={[]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Preview ${first.patternName}` }),
    );
    await screen.findByRole("button", { name: `Pause ${first.patternName}` });
    fireEvent.click(
      screen.getByRole("button", { name: `Preview ${second.patternName}` }),
    );
    await screen.findByRole("button", { name: `Pause ${second.patternName}` });

    expect(runtime.play).toHaveBeenCalledTimes(2);
    expect(runtime.pause).toHaveBeenCalled();
  });

  it("ignores a stale detail response after a newer preview wins", async () => {
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

    render(
      <ClipCollectionGrid
        items={[first, second]}
        selectedSource="owned"
        workspaces={[]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: `Preview ${first.patternName}` }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: `Preview ${second.patternName}` }),
    );
    await screen.findByRole("button", { name: `Pause ${second.patternName}` });

    resolveFirst?.({ ok: true, detail: detail(first) });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `Pause ${second.patternName}` }),
      ).toBeInTheDocument(),
    );
    expect(runtime.play).toHaveBeenCalledOnce();
  });

  it("keeps an unavailable saved bookmark visible with reuse disabled", () => {
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

    expect(
      screen.getByRole("button", { name: `Preview ${saved.patternName}` }),
    ).toBeDisabled();
    expect(screen.getByText(/under review/i)).toBeInTheDocument();
    expect(screen.getByTestId("reuse-controls")).toHaveAttribute(
      "data-can-reuse",
      "false",
    );
    expect(getStudioClipDetailAction).not.toHaveBeenCalled();
  });
});
