import { describe, expect, it, vi } from "vitest";
import { SourceBufferRegistry } from "./source-buffer-registry.client";

const actorA = "00000000-0000-4000-8000-000000000091";
const actorB = "00000000-0000-4000-8000-000000000092";

function buffer(length = 10, channels = 1) {
  return { length, numberOfChannels: channels } as AudioBuffer;
}

describe("SourceBufferRegistry", () => {
  it("shares one in-flight decode for an actor and asset", async () => {
    const registry = new SourceBufferRegistry();
    const load = vi.fn(async () => buffer());
    const first = registry.getOrLoad(actorA, "asset-1", load);
    const second = registry.getOrLoad(actorA, "asset-1", load);
    expect(second.reused).toBe(true);
    expect(await first.promise).toBe(await second.promise);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("clears ready buffers when the verified actor changes", async () => {
    const registry = new SourceBufferRegistry();
    const load = vi.fn(async () => buffer());
    await registry.getOrLoad(actorA, "asset-1", load).promise;
    await registry.getOrLoad(actorB, "asset-1", load).promise;
    expect(load).toHaveBeenCalledTimes(2);
    expect(registry.size).toBe(1);
  });

  it("evicts least-recently-used decoded buffers at its count ceiling", async () => {
    const registry = new SourceBufferRegistry(2, 1_000);
    await registry.getOrLoad(actorA, "asset-1", async () => buffer()).promise;
    await registry.getOrLoad(actorA, "asset-2", async () => buffer()).promise;
    registry.getOrLoad(actorA, "asset-1", async () => buffer());
    await registry.getOrLoad(actorA, "asset-3", async () => buffer()).promise;
    const reload = vi.fn(async () => buffer());
    await registry.getOrLoad(actorA, "asset-2", reload).promise;
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not retain a decoded buffer larger than its byte ceiling", async () => {
    const registry = new SourceBufferRegistry(2, 16);
    await registry.getOrLoad(actorA, "asset-1", async () => buffer(10)).promise;
    expect(registry.size).toBe(0);
  });
});
