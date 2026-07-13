import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STUDIO_FIXTURE_ASSETS,
  STUDIO_FIXTURE_MANIFEST,
} from "../manifest/fixtures";
import { StudioAdapterError } from "../studio-adapter.types";
import { WaveformPlaylistStudioAdapter } from "./adapter.client";

const close = vi.fn(async () => undefined);
const fakeBuffer = { length: 88_200, sampleRate: 44_100 } as AudioBuffer;
const sources = STUDIO_FIXTURE_ASSETS.map(({ assetId, url }) => ({
  assetId,
  signedUrl: url,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
}));
const loadOptions = {
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

  it("maps a missing source to an actionable typed error", async () => {
    const adapter = new WaveformPlaylistStudioAdapter();
    await expect(
      adapter.load({
        manifest: STUDIO_FIXTURE_MANIFEST,
        ...loadOptions,
        sources: [],
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<StudioAdapterError>>({
        code: "missing_source",
      }),
    );
  });
});
