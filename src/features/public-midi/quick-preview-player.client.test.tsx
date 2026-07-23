import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  V3_IDS,
  V3_MANIFEST_BEFORE,
  V3_PATTERN_VERSION_1,
} from "@/features/studio/manifest/v3.fixtures";
import { PublicMidiQuickPreview } from "./quick-preview-player.client";

const runtime = vi.hoisted(() => ({
  prepare: vi.fn().mockResolvedValue(undefined),
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("./preview-runtime.client", () => ({
  PublicMidiPreviewRuntime: class {
    prepare = runtime.prepare;
    play = runtime.play;
    pause = runtime.pause;
    dispose = runtime.dispose;
  },
}));

const revisionId = "90000000-0000-4000-8000-000000000001";
const preview = {
  projectId: V3_IDS.project,
  revisionId,
  revisionNumber: 1,
  projectTitle: "Night Bus",
  manifest: V3_MANIFEST_BEFORE,
  patternVersions: [V3_PATTERN_VERSION_1],
  attributions: [{ kind: "publisher" as const, creditName: "Night Signal" }],
};

function renderPreview(title: string, id = revisionId) {
  return render(
    <PublicMidiQuickPreview
      inline
      projectId={V3_IDS.project}
      revisionId={id}
      title={title}
      durationMs={8_000}
    />,
  );
}

describe("PublicMidiQuickPreview inline mode", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("does not fetch until deliberate play and uses only the public MIDI endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => preview,
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPreview("Night Bus");
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Play Night Bus" }));
    await screen.findByRole("button", { name: "Pause Night Bus" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${V3_IDS.project}/revisions/${revisionId}/preview`,
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toMatch(
      /storage|functions|media/i,
    );
  });

  it("pauses the active preview when another starts", async () => {
    const secondRevisionId = "90000000-0000-4000-8000-000000000002";
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            ...preview,
            revisionId: url.includes(secondRevisionId)
              ? secondRevisionId
              : revisionId,
          }),
        }),
      ),
    );

    render(
      <>
        <PublicMidiQuickPreview
          inline
          projectId={V3_IDS.project}
          revisionId={revisionId}
          title="First signal"
          durationMs={8_000}
        />
        <PublicMidiQuickPreview
          inline
          projectId={V3_IDS.project}
          revisionId={secondRevisionId}
          title="Second signal"
          durationMs={8_000}
        />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play First signal" }));
    await screen.findByRole("button", { name: "Pause First signal" });
    fireEvent.click(screen.getByRole("button", { name: "Play Second signal" }));

    await screen.findByRole("button", { name: "Pause Second signal" });
    expect(
      screen.getByRole("button", { name: "Play First signal" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(runtime.pause).toHaveBeenCalled();
  });

  it("offers an accessible retry after a loading failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => preview });
    vi.stubGlobal("fetch", fetchMock);

    renderPreview("Night Bus");
    fireEvent.click(screen.getByRole("button", { name: "Play Night Bus" }));

    expect(
      await screen.findByRole("button", { name: "Retry Night Bus" }),
    ).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Preview unavailable. Press retry",
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry Night Bus" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Pause Night Bus" }),
      ).toBeVisible(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
