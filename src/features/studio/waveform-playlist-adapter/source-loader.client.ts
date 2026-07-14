"use client";

import type { SignedAudioSource } from "../source-contract";
import {
  StudioAdapterError,
  type StudioTrackReadiness,
} from "../studio-adapter.types";
import {
  markStudioPerformance,
  studioPerformanceMarks,
} from "./performance-marks.client";
import { studioSourceBufferRegistry } from "./source-buffer-registry.client";

export type SourceLoadResult =
  | { status: "ready"; buffer: AudioBuffer }
  | { status: "failed"; error: StudioAdapterError };

export async function loadSources(input: {
  actorId: string;
  assetIds: readonly string[];
  sources: readonly SignedAudioSource[];
  refresh: () => Promise<readonly SignedAudioSource[]>;
  decode: (bytes: ArrayBuffer, assetId: string) => Promise<AudioBuffer>;
  signal: AbortSignal;
  onStatus?: (
    assetId: string,
    status: StudioTrackReadiness,
    error?: StudioAdapterError,
  ) => void;
  onBuffer?: (assetId: string, buffer: AudioBuffer) => void;
  concurrency?: number;
}): Promise<Map<string, SourceLoadResult>> {
  let sources = new Map(
    input.sources.map((source) => [source.assetId, source]),
  );
  let refreshPromise: Promise<void> | null = null;
  let refreshed = false;
  let cursor = 0;
  const output = new Map<string, SourceLoadResult>();

  const refreshOnce = async () => {
    if (refreshed)
      throw new StudioAdapterError(
        "expired_source",
        "Audio access expired. Retry this track.",
      );
    refreshPromise ??= input.refresh().then((next) => {
      sources = new Map(next.map((source) => [source.assetId, source]));
      refreshed = true;
    });
    await refreshPromise;
  };

  const fetchAndDecode = async (assetId: string, sourceIndex: number) => {
    let source = sources.get(assetId);
    if (!source)
      throw new StudioAdapterError(
        "missing_source",
        "This track's audio is unavailable.",
      );
    if (Date.parse(source.expiresAt) - Date.now() <= 60_000) {
      await refreshOnce();
      source = sources.get(assetId);
    }
    if (!source)
      throw new StudioAdapterError(
        "missing_source",
        "This track's audio is unavailable.",
      );

    const request = async (signedUrl: string) => {
      try {
        markStudioPerformance(studioPerformanceMarks.sourceFetchStart, {
          sourceIndex,
        });
        return await fetch(signedUrl, {
          signal: input.signal,
          cache: "default",
        });
      } catch (error) {
        if (input.signal.aborted)
          throw new StudioAdapterError(
            "cancelled",
            "Studio loading was cancelled.",
          );
        throw new StudioAdapterError(
          "fetch_failed",
          "This track could not be downloaded. Check your connection and retry.",
          { cause: error },
        );
      }
    };

    let response = await request(source.signedUrl);
    if (response.status === 401 || response.status === 403) {
      if (sources.get(assetId)?.signedUrl === source.signedUrl)
        await refreshOnce();
      const retry = sources.get(assetId);
      if (!retry)
        throw new StudioAdapterError(
          "missing_source",
          "This track's audio is unavailable.",
        );
      response = await request(retry.signedUrl);
      if (response.status === 401 || response.status === 403)
        throw new StudioAdapterError(
          "expired_source",
          "Audio access expired. Retry this track.",
        );
    }
    if (response.status === 404)
      throw new StudioAdapterError(
        "missing_source",
        "This track's audio is unavailable.",
      );
    if (!response.ok)
      throw new StudioAdapterError(
        "fetch_failed",
        "This track could not be downloaded. Retry it in a moment.",
      );

    const bytes = await response.arrayBuffer();
    markStudioPerformance(studioPerformanceMarks.sourceFetchEnd, {
      sourceIndex,
    });
    input.onStatus?.(assetId, "decoding");
    try {
      markStudioPerformance(studioPerformanceMarks.sourceDecodeStart, {
        sourceIndex,
      });
      const buffer = await input.decode(bytes, assetId);
      markStudioPerformance(studioPerformanceMarks.sourceDecodeEnd, {
        sourceIndex,
      });
      return buffer;
    } catch (error) {
      throw new StudioAdapterError(
        "decode_failed",
        "This track uses audio this browser could not decode.",
        { cause: error },
      );
    }
  };

  const loadOne = async (assetId: string, sourceIndex: number) => {
    if (input.signal.aborted) return;
    input.onStatus?.(assetId, "loading");
    try {
      const cached = studioSourceBufferRegistry.getOrLoad(
        input.actorId,
        assetId,
        () => fetchAndDecode(assetId, sourceIndex),
      );
      const buffer = await waitForAbort(cached.promise, input.signal);
      output.set(assetId, { status: "ready", buffer });
      input.onBuffer?.(assetId, buffer);
      input.onStatus?.(assetId, "ready");
    } catch (error) {
      const typed =
        error instanceof StudioAdapterError
          ? error
          : new StudioAdapterError(
              input.signal.aborted ? "cancelled" : "fetch_failed",
              input.signal.aborted
                ? "Studio loading was cancelled."
                : "This track could not be loaded.",
              { cause: error },
            );
      if (typed.code !== "cancelled") {
        output.set(assetId, { status: "failed", error: typed });
        input.onStatus?.(assetId, "failed", typed);
      }
    }
  };

  const worker = async () => {
    while (!input.signal.aborted) {
      const index = cursor++;
      const assetId = input.assetIds[index];
      if (!assetId) return;
      await loadOne(assetId, index);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(input.concurrency ?? 3, input.assetIds.length) },
      worker,
    ),
  );
  return output;
}

function waitForAbort<T>(promise: Promise<T>, signal: AbortSignal) {
  if (signal.aborted)
    return Promise.reject(
      new StudioAdapterError("cancelled", "Studio loading was cancelled."),
    );
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      reject(
        new StudioAdapterError("cancelled", "Studio loading was cancelled."),
      );
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
