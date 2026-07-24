import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getStudioClipDetailAction,
  importStudioClipAction,
  listStudioClipCollectionAction,
  type StudioClipFailureCode,
} from "./actions";
import {
  studioClipCollectionSchema,
  studioClipDetailSchema,
  type ImportStudioClipResult,
} from "./schema";
import { StudioClipDrawer } from "./studio-clip-drawer.client";

const runtimeInstances: Array<{
  prepare: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("./actions", () => ({
  listStudioClipCollectionAction: vi.fn(),
  getStudioClipDetailAction: vi.fn(),
  importStudioClipAction: vi.fn(),
}));

vi.mock("@/features/public-midi/preview-runtime.client", () => ({
  PublicMidiPreviewRuntime: class {
    prepare = vi.fn().mockResolvedValue(undefined);
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    dispose = vi.fn();

    constructor() {
      runtimeInstances.push(this);
    }
  },
}));

const uuid = (suffix: number) =>
  `40000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;
const createdAt = "2026-07-24T12:00:00.000Z";

function item(suffix: number, overrides: Record<string, unknown> = {}) {
  return studioClipCollectionSchema.parse({
    items: [
      {
        patternId: uuid(suffix),
        patternVersionId: uuid(suffix + 100),
        patternName: `Clip ${suffix}`,
        versionNumber: suffix,
        creatorId: uuid(suffix + 200),
        creatorCreditName: `Creator ${suffix}`,
        durationTicks: 1_920,
        noteCount: 2,
        createdAt,
        hasLineage: true,
        source: "owned",
        isOwned: true,
        isSaved: false,
        availability: "available",
        canImport: true,
        preset: { id: "warm-keys", version: 1, name: "Warm keys" },
        ...overrides,
      },
    ],
  }).items[0]!;
}

function detail(clip = item(1)) {
  return studioClipDetailSchema.parse({
    metadata: clip,
    externalCredits: [],
    pattern: {
      midiPatternVersionId: clip.patternVersionId,
      midiPatternId: clip.patternId,
      version: clip.versionNumber,
      creatorId: clip.creatorId,
      creatorCreditName: clip.creatorCreditName,
      parentMidiPatternVersionId: null,
      sourceMidiPatternVersionId: null,
      contentSha256: "a".repeat(64),
      noteCount: 2,
      ppq: 480,
      durationTicks: clip.durationTicks,
      reuseLicense: null,
      createdAt,
      name: clip.patternName,
      presetId: clip.preset!.id,
      presetVersion: clip.preset!.version,
      notes: [
        {
          noteId: uuid(901),
          startTick: 0,
          durationTicks: 240,
          pitch: 60,
          velocity: 90,
        },
        {
          noteId: uuid(902),
          startTick: 480,
          durationTicks: 240,
          pitch: 64,
          velocity: 80,
        },
      ],
    },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function Harness({
  initiallyOpen = false,
  prepareImport = vi.fn().mockResolvedValue({
    ok: true,
    workspaceId: uuid(700),
    expectedWorkspaceLockVersion: 7,
    startTick: 960,
  }),
  onImported = vi.fn(),
  onImportFailure = vi.fn(),
}: {
  initiallyOpen?: boolean;
  prepareImport?: () => Promise<
    | {
        ok: true;
        workspaceId: string;
        expectedWorkspaceLockVersion: number;
        startTick: number;
      }
    | { ok: false; message: string }
  >;
  onImported?: (result: ImportStudioClipResult) => void;
  onImportFailure?: (code: StudioClipFailureCode) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Add from clips
      </button>
      <StudioClipDrawer
        open={open}
        onOpenChange={setOpen}
        triggerRef={triggerRef}
        prepareImport={prepareImport}
        onImported={onImported}
        onImportFailure={onImportFailure}
      />
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  runtimeInstances.length = 0;
  vi.mocked(listStudioClipCollectionAction).mockResolvedValue({
    ok: true,
    collection: { items: [item(1), item(2)] },
  });
  vi.mocked(getStudioClipDetailAction).mockImplementation(async (input) => {
    const { patternVersionId } = input as { patternVersionId: string };
    const clip = [item(1), item(2)].find(
      (candidate) => candidate.patternVersionId === patternVersionId,
    )!;
    return { ok: true, detail: detail(clip) };
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("StudioClipDrawer", () => {
  it("loads nothing before opening, then loads only the selected source without note detail", async () => {
    render(<Harness />);
    expect(listStudioClipCollectionAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add from clips" }));
    await waitFor(() =>
      expect(listStudioClipCollectionAction).toHaveBeenCalledWith({
        source: "owned",
        query: null,
        limit: 100,
      }),
    );
    expect(getStudioClipDetailAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Saved clips" }));
    await waitFor(() =>
      expect(listStudioClipCollectionAction).toHaveBeenLastCalledWith({
        source: "saved",
        query: null,
        limit: 100,
      }),
    );
    expect(getStudioClipDetailAction).not.toHaveBeenCalled();
  });

  it("submits bounded search deliberately and ignores an older response that resolves last", async () => {
    const first =
      deferred<Awaited<ReturnType<typeof listStudioClipCollectionAction>>>();
    const second =
      deferred<Awaited<ReturnType<typeof listStudioClipCollectionAction>>>();
    vi.mocked(listStudioClipCollectionAction)
      .mockResolvedValueOnce({
        ok: true,
        collection: { items: [item(1)] },
      })
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    render(<Harness initiallyOpen />);
    await screen.findByText("Clip 1");
    const search = screen.getByPlaceholderText("Title or creator");
    fireEvent.change(search, { target: { value: "first" } });
    expect(listStudioClipCollectionAction).toHaveBeenCalledTimes(1);
    fireEvent.submit(search.closest("form")!);
    await waitFor(() =>
      expect(listStudioClipCollectionAction).toHaveBeenCalledTimes(2),
    );
    fireEvent.change(search, { target: { value: "second" } });
    fireEvent.submit(search.closest("form")!);
    await waitFor(() =>
      expect(listStudioClipCollectionAction).toHaveBeenCalledTimes(3),
    );
    second.resolve({
      ok: true,
      collection: { items: [item(22)] },
    });
    expect(await screen.findByText("Clip 22")).toBeVisible();
    first.resolve({
      ok: true,
      collection: { items: [item(11)] },
    });
    await Promise.resolve();
    expect(screen.queryByText("Clip 11")).not.toBeInTheDocument();
    expect(screen.getByText("Clip 22")).toBeVisible();
    expect(
      vi.mocked(listStudioClipCollectionAction).mock.calls[2]![0],
    ).toMatchObject({ query: "second" });
  });

  it("keeps unavailable saved clips visible with truthful disabled controls", async () => {
    const unavailable = item(4, {
      patternName: "Quiet bookmark",
      source: "saved",
      isOwned: false,
      isSaved: true,
      savedListingId: uuid(804),
      savedAt: createdAt,
      savedAvailability: "moderation_hidden",
      savedCanImport: false,
      availability: "moderation_hidden",
      canImport: false,
      preset: undefined,
    });
    vi.mocked(listStudioClipCollectionAction).mockImplementation(
      async (input) => {
        const { source } = input as { source: string };
        return {
          ok: true,
          collection: { items: source === "saved" ? [unavailable] : [] },
        };
      },
    );
    render(<Harness initiallyOpen />);
    fireEvent.click(screen.getByRole("tab", { name: "Saved clips" }));
    const card = (await screen.findByText("Quiet bookmark")).closest(
      "article",
    )!;
    expect(within(card).getByText("Unavailable")).toBeVisible();
    expect(within(card).getByText(/under review/)).toBeVisible();
    expect(
      within(card).getByRole("button", { name: "Preview Quiet bookmark" }),
    ).toBeDisabled();
    expect(
      within(card).getByRole("button", { name: "Add as new track" }),
    ).toBeDisabled();
  });

  it("loads exact detail on demand and allows only one local preview at a time", async () => {
    render(<Harness initiallyOpen />);
    await screen.findByText("Clip 1");
    fireEvent.click(screen.getByRole("button", { name: "Preview Clip 1" }));
    await waitFor(() => expect(runtimeInstances).toHaveLength(1));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Pause Clip 1" }),
      ).toBeVisible(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview Clip 2" }));
    await waitFor(() => expect(runtimeInstances).toHaveLength(2));
    expect(runtimeInstances[0]!.dispose).toHaveBeenCalledOnce();
    expect(getStudioClipDetailAction).toHaveBeenCalledTimes(2);
    expect(runtimeInstances[1]!.prepare).toHaveBeenCalledOnce();
  });

  it("keeps the newest preview authoritative when older detail resolves last", async () => {
    const first =
      deferred<Awaited<ReturnType<typeof getStudioClipDetailAction>>>();
    const second =
      deferred<Awaited<ReturnType<typeof getStudioClipDetailAction>>>();
    vi.mocked(getStudioClipDetailAction).mockImplementation((input) => {
      const { patternVersionId } = input as { patternVersionId: string };
      return patternVersionId === item(1).patternVersionId
        ? first.promise
        : second.promise;
    });
    render(<Harness initiallyOpen />);
    await screen.findByText("Clip 1");
    fireEvent.click(screen.getByRole("button", { name: "Preview Clip 1" }));
    await waitFor(() =>
      expect(getStudioClipDetailAction).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview Clip 2" }));
    await waitFor(() =>
      expect(getStudioClipDetailAction).toHaveBeenCalledTimes(2),
    );

    second.resolve({ ok: true, detail: detail(item(2)) });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Pause Clip 2" }),
      ).toBeVisible(),
    );
    expect(runtimeInstances).toHaveLength(1);
    const secondRuntime = runtimeInstances[0]!;

    first.resolve({ ok: true, detail: detail(item(1)) });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(runtimeInstances).toHaveLength(1);
    expect(secondRuntime.dispose).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Pause Clip 1" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause Clip 2" })).toBeVisible();
  });

  it("imports with exact source, live playhead authority, a fresh request id, and pending deduplication", async () => {
    const pending =
      deferred<Awaited<ReturnType<typeof importStudioClipAction>>>();
    const prepareImport = vi.fn().mockResolvedValue({
      ok: true,
      workspaceId: uuid(700),
      expectedWorkspaceLockVersion: 7,
      startTick: 960,
    });
    const onImported = vi.fn();
    vi.mocked(importStudioClipAction).mockImplementation(() => pending.promise);
    render(
      <Harness
        initiallyOpen
        prepareImport={prepareImport}
        onImported={onImported}
      />,
    );
    const firstCard = (await screen.findByText("Clip 1")).closest("article")!;
    const add = within(firstCard).getByRole("button", {
      name: "Add as new track",
    });
    fireEvent.click(add);
    fireEvent.click(add);
    await waitFor(() => expect(importStudioClipAction).toHaveBeenCalledOnce());
    expect(importStudioClipAction).toHaveBeenCalledWith({
      patternVersionId: item(1).patternVersionId,
      source: "owned",
      workspaceId: uuid(700),
      requestId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      expectedWorkspaceLockVersion: 7,
      startTick: 960,
    });
    expect(
      screen.getByRole("button", { name: /Adding at playhead/ }),
    ).toBeDisabled();
    pending.resolve({ ok: false, code: "track_limit" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "maximum number of tracks",
    );
    expect(onImported).not.toHaveBeenCalled();
  });

  it("locks dismissal and second actions until successful canonical handoff applies once", async () => {
    const onImported = vi.fn();
    const successfulResult = {
      workspaceId: uuid(700),
    } as ImportStudioClipResult;
    vi.mocked(importStudioClipAction).mockResolvedValue({
      ok: true,
      result: successfulResult,
    });
    render(<Harness initiallyOpen onImported={onImported} />);
    const firstCard = (await screen.findByText("Clip 1")).closest("article")!;

    await act(async () => {
      fireEvent.click(
        within(firstCard).getByRole("button", { name: "Add as new track" }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Added to the arrangement")).toBeVisible();
    expect(onImported).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Add from clips" });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(
      screen.getByRole("button", { name: "Close clip collection" }),
    );
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close Add from clips" }),
    ).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Saved clips" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Title or creator")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Preview Clip 2" }),
    ).toBeDisabled();
    expect(
      within(firstCard).getByRole("button", { name: "Add as new track" }),
    ).toBeDisabled();

    await waitFor(() => expect(onImported).toHaveBeenCalledOnce(), {
      timeout: 1_000,
    });
    expect(onImported).toHaveBeenCalledWith(successfulResult);
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add from clips" }),
      ).not.toBeInTheDocument(),
    );
    const trigger = screen.getByRole("button", { name: "Add from clips" });
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: "Add from clips" }),
      ).toBeVisible(),
    );
    expect(screen.getByRole("tab", { name: "Saved clips" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Preview Clip 1" }),
    ).toBeEnabled();
    expect(onImported).toHaveBeenCalledOnce();
  });

  it("reports stale authority and restores exact trigger focus after Escape", async () => {
    const onImportFailure = vi.fn();
    vi.mocked(importStudioClipAction).mockResolvedValue({
      ok: false,
      code: "workspace_stale",
    });
    render(<Harness onImportFailure={onImportFailure} />);
    const trigger = screen.getByRole("button", { name: "Add from clips" });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", {
      name: "Add from clips",
    });
    expect(dialog.className).toContain("max-sm:max-h");
    const firstCard = (await screen.findByText("Clip 1")).closest("article")!;
    fireEvent.click(
      within(firstCard).getByRole("button", { name: "Add as new track" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "changed elsewhere",
    );
    expect(onImportFailure).toHaveBeenCalledWith("workspace_stale");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add from clips" }),
      ).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});
