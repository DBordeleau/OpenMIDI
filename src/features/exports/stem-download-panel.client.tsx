"use client";

import { useRef, useState } from "react";
import type { StemExportResponse } from "./contract";

type DownloadState =
  | { status: "idle"; message: string }
  | { status: "preparing"; message: string }
  | { status: "downloading"; message: string; progress: number | null }
  | { status: "complete"; message: string }
  | { status: "cancelled"; message: string }
  | { status: "error"; message: string };

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

async function readDownload(
  response: Response,
  mediaType: string,
  onProgress: (progress: number | null) => void,
) {
  if (!response.ok) throw new Error(`storage_${response.status}`);
  if (!response.body) return response.blob();
  const total = Number(response.headers.get("Content-Length")) || null;
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    chunks.push(copy.buffer);
    received += value.byteLength;
    onProgress(total ? Math.min(1, received / total) : null);
  }
  return new Blob(chunks, { type: mediaType });
}

export function StemDownloadPanel({
  endpoint,
  assetIds,
  disabled = false,
}: {
  endpoint: string;
  assetIds: string[];
  disabled?: boolean;
}) {
  const [state, setState] = useState<DownloadState>({
    status: "idle",
    message:
      "Original WAV, FLAC, or MP3 sources; mixer settings are in the manifest.",
  });
  const controller = useRef<AbortController | null>(null);

  const start = async () => {
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: "preparing", message: "Preparing private downloads…" });
    try {
      const metadataResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds }),
        cache: "no-store",
        signal: abort.signal,
      });
      if (!metadataResponse.ok) throw new Error("metadata_unavailable");
      const metadata = (await metadataResponse.json()) as StemExportResponse;
      for (const [index, file] of metadata.files.entries()) {
        setState({
          status: "downloading",
          message: `Downloading ${index + 1} of ${metadata.files.length}: ${file.filename}`,
          progress: null,
        });
        const response = await fetch(file.signedUrl, { signal: abort.signal });
        const blob = await readDownload(response, file.mediaType, (progress) =>
          setState({
            status: "downloading",
            message: `Downloading ${index + 1} of ${metadata.files.length}: ${file.filename}`,
            progress,
          }),
        );
        if (abort.signal.aborted)
          throw new DOMException("Aborted", "AbortError");
        saveBlob(blob, file.filename);
      }
      const safeManifest = {
        version: metadata.version,
        projectId: metadata.projectId,
        projectTitle: metadata.projectTitle,
        revisionId: metadata.revisionId,
        revisionNumber: metadata.revisionNumber,
        workspaceId: metadata.workspaceId,
        files: metadata.files.map(
          ({ signedUrl: _signedUrl, expiresAt: _expiresAt, ...file }) => file,
        ),
      };
      saveBlob(
        new Blob([JSON.stringify(safeManifest, null, 2)], {
          type: "application/json",
        }),
        "jam-session-manifest-v1.json",
      );
      setState({
        status: "complete",
        message: `Prepared ${metadata.files.length} source files and the Jam Session manifest.`,
      });
    } catch (error) {
      setState(
        error instanceof DOMException && error.name === "AbortError"
          ? { status: "cancelled", message: "Stem download cancelled safely." }
          : {
              status: "error",
              message:
                "The private downloads could not be completed. Start again for fresh links.",
            },
      );
    } finally {
      controller.current = null;
    }
  };

  const active = state.status === "preparing" || state.status === "downloading";
  return (
    <section className="rounded-card border-subtle bg-surface border p-5">
      <h2 className="font-bold">Download original stems</h2>
      <p className="text-muted mt-1 text-sm">
        Downloads multiple original source files plus a Jam Session manifest.
      </p>
      <p className="mt-3 text-sm" aria-live="polite">
        {state.message}
      </p>
      {state.status === "downloading" && state.progress !== null && (
        <progress className="mt-3 w-full" value={state.progress} max={1}>
          {Math.round(state.progress * 100)}%
        </progress>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-control border-strong min-h-11 border px-4 disabled:opacity-50"
          disabled={disabled || active || assetIds.length === 0}
          onClick={() => void start()}
        >
          Download {assetIds.length} {assetIds.length === 1 ? "stem" : "stems"}
        </button>
        {active && (
          <button
            type="button"
            className="rounded-control border-strong min-h-11 border px-4"
            onClick={() => controller.current?.abort()}
          >
            Cancel download
          </button>
        )}
      </div>
    </section>
  );
}
