"use client";

type RegistryEntry = {
  promise: Promise<AudioBuffer>;
  byteSize: number | null;
  lastUsed: number;
};

const DEFAULT_MAX_ENTRIES = 12;
const DEFAULT_MAX_BYTES = 384 * 1024 * 1024;

export class SourceBufferRegistry {
  private actorId: string | null = null;
  private readonly entries = new Map<string, RegistryEntry>();
  private clock = 0;

  constructor(
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
    private readonly maxBytes = DEFAULT_MAX_BYTES,
  ) {}

  activateActor(actorId: string) {
    if (this.actorId === actorId) return;
    this.clear();
    this.actorId = actorId;
  }

  getOrLoad(
    actorId: string,
    assetId: string,
    load: () => Promise<AudioBuffer>,
  ): { promise: Promise<AudioBuffer>; reused: boolean } {
    this.activateActor(actorId);
    const existing = this.entries.get(assetId);
    if (existing) {
      existing.lastUsed = ++this.clock;
      return { promise: existing.promise, reused: true };
    }

    this.evictToEntryLimit();
    if (this.entries.size >= this.maxEntries)
      return { promise: load(), reused: false };
    const entry: RegistryEntry = {
      byteSize: null,
      lastUsed: ++this.clock,
      promise: Promise.resolve(undefined as unknown as AudioBuffer),
    };
    entry.promise = load()
      .then((buffer) => {
        entry.byteSize = estimateAudioBufferBytes(buffer);
        this.evictToByteLimit(assetId);
        return buffer;
      })
      .catch((error: unknown) => {
        if (this.entries.get(assetId) === entry) this.entries.delete(assetId);
        throw error;
      });
    this.entries.set(assetId, entry);
    return { promise: entry.promise, reused: false };
  }

  delete(assetId: string) {
    this.entries.delete(assetId);
  }

  clear() {
    this.entries.clear();
  }

  get size() {
    return this.entries.size;
  }

  private evictToEntryLimit() {
    while (this.entries.size >= this.maxEntries) {
      const candidate = this.oldestResolvedEntry();
      if (!candidate) break;
      this.entries.delete(candidate);
    }
  }

  private evictToByteLimit(newAssetId: string) {
    const newest = this.entries.get(newAssetId);
    if ((newest?.byteSize ?? 0) > this.maxBytes) {
      this.entries.delete(newAssetId);
      return;
    }
    while (this.totalBytes() > this.maxBytes) {
      const candidate = this.oldestResolvedEntry(newAssetId);
      if (!candidate) break;
      this.entries.delete(candidate);
    }
  }

  private oldestResolvedEntry(except?: string) {
    return [...this.entries.entries()]
      .filter(
        ([assetId, entry]) => assetId !== except && entry.byteSize !== null,
      )
      .sort((left, right) => left[1].lastUsed - right[1].lastUsed)[0]?.[0];
  }

  private totalBytes() {
    return [...this.entries.values()].reduce(
      (total, entry) => total + (entry.byteSize ?? 0),
      0,
    );
  }
}

function estimateAudioBufferBytes(buffer: AudioBuffer) {
  return (
    buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT
  );
}

export const studioSourceBufferRegistry = new SourceBufferRegistry();

export function clearStudioSourceBufferRegistry() {
  studioSourceBufferRegistry.clear();
}
