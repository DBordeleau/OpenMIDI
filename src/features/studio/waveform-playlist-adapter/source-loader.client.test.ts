import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSources } from "./source-loader.client";
import { clearStudioSourceBufferRegistry } from "./source-buffer-registry.client";

const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
];
const signed = (suffix = "initial") =>
  ids.map((assetId) => ({
    assetId,
    signedUrl: `https://example.test/${suffix}/${assetId}`,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  }));

describe("loadSources", () => {
  afterEach(() => {
    clearStudioSourceBufferRegistry();
    vi.unstubAllGlobals();
  });

  it("limits source work to three and reports progressive status", async () => {
    let active = 0;
    let maximum = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await Promise.resolve();
        active -= 1;
        return new Response(new Uint8Array([1]));
      }),
    );
    const status = vi.fn();
    const result = await loadSources({
      actorId: "00000000-0000-4000-8000-000000000099",
      assetIds: ids,
      sources: signed(),
      refresh: async () => signed("refresh"),
      decode: async () => ({}) as AudioBuffer,
      signal: new AbortController().signal,
      onStatus: status,
    });
    expect(maximum).toBeLessThanOrEqual(3);
    expect(result.size).toBe(4);
    expect(status).toHaveBeenCalledWith(ids[0], "loading");
    expect(status).toHaveBeenCalledWith(ids[0], "decoding");
    expect(status).toHaveBeenCalledWith(ids[0], "ready");
  });

  it("deduplicates one refresh for concurrent authorization failures", async () => {
    const refresh = vi.fn(async () => signed("refresh"));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string | URL | Request) =>
          new Response(new Uint8Array([1]), {
            status: String(url).includes("initial") ? 403 : 200,
          }),
      ),
    );
    await loadSources({
      actorId: "00000000-0000-4000-8000-000000000099",
      assetIds: ids,
      sources: signed(),
      refresh,
      decode: async () => ({}) as AudioBuffer,
      signal: new AbortController().signal,
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("isolates one failure and keeps successfully decoded sources", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) =>
        String(url).includes(ids[1]!)
          ? new Response(null, { status: 404 })
          : new Response(new Uint8Array([1])),
      ),
    );
    const result = await loadSources({
      actorId: "00000000-0000-4000-8000-000000000099",
      assetIds: ids.slice(0, 3),
      sources: signed(),
      refresh: async () => signed("refresh"),
      decode: async () => ({}) as AudioBuffer,
      signal: new AbortController().signal,
    });
    expect(result.get(ids[0])).toMatchObject({ status: "ready" });
    expect(result.get(ids[1])).toMatchObject({ status: "failed" });
    expect(result.get(ids[2])).toMatchObject({ status: "ready" });
  });
});
