import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STUDIO_FIXTURE_ASSETS,
  STUDIO_FIXTURE_MANIFEST,
} from "../manifest/fixtures";
import { WaveformPlaylistStudioAdapter } from "./adapter.client";
import { clearStudioSourceBufferRegistry } from "./source-buffer-registry.client";

const close = vi.fn(async () => undefined);
const fakeBuffer = { length: 88_200, sampleRate: 44_100 } as AudioBuffer;
const sources = STUDIO_FIXTURE_ASSETS.map(({ assetId, url }) => ({
  assetId,
  signedUrl: url,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
}));
const loadOptions = {
  actorId: "00000000-0000-4000-8000-000000000099",
  sources,
  refreshSources: async () => sources,
  signal: new AbortController().signal,
};

class FakeAudioContext {
  close = close;
  async decodeAudioData() {
    return fakeBuffer;
  }
}

describe("WaveformPlaylistStudioAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("OfflineAudioContext", class {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearStudioSourceBufferRegistry();
    vi.clearAllMocks();
  });

  it("loads, mutates, and exports deterministic promoted state", async () => {
    const adapter = new WaveformPlaylistStudioAdapter();
    await adapter.load({
      manifest: STUDIO_FIXTURE_MANIFEST,
      ...loadOptions,
    });
    adapter.updateTrack("00000000-0000-4000-8000-000000000011", {
      muted: true,
    });
    expect(adapter.exportManifest().tracks[0]).toEqual({
      ...STUDIO_FIXTURE_MANIFEST.tracks[0],
      muted: true,
    });
    adapter.reorderTracks([
      "00000000-0000-4000-8000-000000000012",
      "00000000-0000-4000-8000-000000000011",
    ]);
    expect(
      adapter.exportManifest().tracks.map((track) => track.sortOrder),
    ).toEqual([0, 1]);
    adapter.removeTrack("00000000-0000-4000-8000-000000000012");
    expect(adapter.exportManifest().tracks).toHaveLength(1);
  });

  it("disposes idempotently and rejects later calls predictably", async () => {
    const adapter = new WaveformPlaylistStudioAdapter();
    await adapter.load({
      manifest: STUDIO_FIXTURE_MANIFEST,
      ...loadOptions,
    });
    await adapter.dispose();
    await adapter.dispose();
    expect(close).toHaveBeenCalledTimes(1);
    await expect(adapter.play()).rejects.toMatchObject({
      code: "invalid_state",
    });
  });

  it("maps a missing source to one failed track without discarding the shell", async () => {
    const adapter = new WaveformPlaylistStudioAdapter();
    adapter.prepare(STUDIO_FIXTURE_MANIFEST, loadOptions.actorId);
    await adapter.load({
      manifest: STUDIO_FIXTURE_MANIFEST,
      ...loadOptions,
      sources: [],
    });
    expect(adapter.getSnapshot().tracks).toHaveLength(2);
    expect(adapter.getSnapshot().trackLoadStates).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "failed" })]),
    );
  });

  it("exposes manifest tracks before downloads resolve and preserves edits", async () => {
    const releases: Array<() => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            releases.push(() => resolve(new Response(new Uint8Array([1]))));
          }),
      ),
    );
    const adapter = new WaveformPlaylistStudioAdapter();
    adapter.prepare(STUDIO_FIXTURE_MANIFEST, loadOptions.actorId);
    const loading = adapter.load({
      manifest: STUDIO_FIXTURE_MANIFEST,
      ...loadOptions,
    });
    expect(adapter.getSnapshot().tracks).toHaveLength(2);
    expect(
      adapter.getSnapshot().tracks[0]?.clips[0]?.audioBuffer,
    ).toBeUndefined();
    adapter.updateTrack("00000000-0000-4000-8000-000000000011", {
      name: "Edited while loading",
    });
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    for (const release of releases) release();
    await loading;
    expect(adapter.exportManifest().tracks[0]?.name).toBe(
      "Edited while loading",
    );
  });

  it("requires every audible track but does not let a muted queued track block playback", async () => {
    let releaseSecond: (() => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        if (!String(url).includes("stem-b"))
          return new Response(new Uint8Array([1]));
        return new Promise<Response>((resolve) => {
          releaseSecond = () => resolve(new Response(new Uint8Array([1])));
        });
      }),
    );
    const adapter = new WaveformPlaylistStudioAdapter();
    adapter.prepare(STUDIO_FIXTURE_MANIFEST, loadOptions.actorId);
    const loading = adapter.load({
      manifest: STUDIO_FIXTURE_MANIFEST,
      ...loadOptions,
    });
    await vi.waitFor(() =>
      expect(adapter.getSnapshot().trackLoadStates[0]?.status).toBe("ready"),
    );
    expect(adapter.getSnapshot().playbackReady).toBe(false);
    adapter.updateTrack("00000000-0000-4000-8000-000000000012", {
      muted: true,
    });
    expect(adapter.getSnapshot().playbackReady).toBe(true);
    adapter.updateTrack("00000000-0000-4000-8000-000000000012", {
      muted: false,
    });
    expect(adapter.getSnapshot().playbackReady).toBe(false);
    releaseSecond?.();
    await loading;
    expect(adapter.getSnapshot().playbackReady).toBe(true);
  });
});
