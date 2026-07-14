"use client";

import { useEffect, useRef, useState } from "react";
import { FiCheck, FiUploadCloud, FiX } from "react-icons/fi";
import { Upload } from "tus-js-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSupabasePublicEnv } from "@/lib/env/public";
import { cancelUpload, completeUpload, reserveUpload } from "./actions";
import { AssetVerificationStatus } from "./asset-verification-status";
import { preflightSourceFile } from "./schema";
import type { GeneratedPeaks } from "./browser-codec/contract";

type PendingWav = {
  file: File;
  capabilityReason: string | null;
};

export function SourceUpload() {
  const [message, setMessage] = useState("Select a source file to begin.");
  const [progress, setProgress] = useState(0);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [isPreparingUpload, setIsPreparingUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [hasActiveUpload, setHasActiveUpload] = useState(false);
  const [pendingWav, setPendingWav] = useState<PendingWav | null>(null);
  const [verificationAssetId, setVerificationAssetId] = useState<string | null>(
    null,
  );
  const [verificationKickDelayed, setVerificationKickDelayed] = useState(false);
  const activeUpload = useRef<Upload | null>(null);
  const activeAssetId = useRef<string | null>(null);
  const conversionAbort = useRef<AbortController | null>(null);
  const generatedPeaks = useRef<GeneratedPeaks | null>(null);

  useEffect(
    () => () => {
      conversionAbort.current?.abort();
      void activeUpload.current?.abort();
    },
    [],
  );

  async function selectFile(file: File) {
    try {
      setMessage("Checking file...");
      setVerificationAssetId(null);
      setVerificationKickDelayed(false);
      setPendingWav(null);
      generatedPeaks.current = null;
      const hint = await preflightSourceFile(file);
      if (hint.format !== "wav") {
        await startUpload(file, hint.durationMs);
        return;
      }
      const primitivesSupported =
        typeof Worker === "function" && typeof WebAssembly === "object";
      const navigatorWithMemory = navigator as Navigator & {
        deviceMemory?: number;
      };
      const memorySupported =
        navigatorWithMemory.deviceMemory === undefined ||
        navigatorWithMemory.deviceMemory >= 4;
      const capabilityReason = !primitivesSupported
        ? "This browser cannot run the lossless encoder."
        : !memorySupported
          ? "This device reports limited memory for lossless conversion."
          : null;
      setPendingWav({ file, capabilityReason });
      setMessage(
        capabilityReason
          ? `${capabilityReason} Upload the original WAV instead.`
          : "WAV ready. Choose lossless optimization or upload the original WAV.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "File check failed.");
    }
  }

  async function optimizePendingWav() {
    if (!pendingWav || pendingWav.capabilityReason) return;
    const original = pendingWav.file;
    const abort = new AbortController();
    conversionAbort.current = abort;
    setIsConverting(true);
    setConversionProgress(0);
    setMessage("Optimizing WAV to lossless FLAC in your browser...");
    try {
      const { optimizeWavLosslessly } =
        await import("./browser-codec/flac-optimizer.client");
      const result = await optimizeWavLosslessly(original, {
        signal: abort.signal,
        onProgress: setConversionProgress,
      });
      generatedPeaks.current = result.peaks;
      setPendingWav(null);
      setMessage(
        `Lossless FLAC ready (${formatBytes(original.size)} to ${formatBytes(result.file.size)}). Uploading the canonical FLAC; the original WAV bytes will not be stored.`,
      );
      await startUpload(
        result.file,
        Math.round(result.metadata.durationSeconds * 1_000),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        setMessage(
          "Lossless optimization cancelled. The original WAV is still ready to upload.",
        );
      else
        setMessage(
          `${error instanceof Error ? error.message : "Lossless optimization failed."} The original WAV is still ready to upload.`,
        );
    } finally {
      conversionAbort.current = null;
      setIsConverting(false);
      setConversionProgress(0);
    }
  }

  async function startUpload(file: File, durationMs: number | null) {
    setIsPreparingUpload(true);
    try {
      const hint = await preflightSourceFile(file);
      const db = createSupabaseBrowserClient();
      const { data } = await db.auth.getSession();
      if (!data.session)
        throw new Error("Your session expired. Sign in again.");
      const requestId = crypto.randomUUID();
      const reserved = await reserveUpload({
        byteSize: hint.byteSize,
        filename: hint.filename,
        mediaType: hint.mediaType,
        durationMs,
        requestId,
      });
      if (!reserved.instruction) throw new Error(reserved.error);
      setMessage("Uploading directly to private storage...");
      setIsUploading(true);
      setHasActiveUpload(true);
      setProgress(0);
      activeAssetId.current = reserved.instruction.assetId;
      const upload = new Upload(file, {
        endpoint: getSupabasePublicEnv().storageTusUrl,
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: {
          authorization: `Bearer ${data.session.access_token}`,
          "x-upsert": "false",
        },
        metadata: {
          bucketName: reserved.instruction.bucket,
          objectName: reserved.instruction.objectPath,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        fingerprint: () =>
          Promise.resolve(
            `jam-source-${data.session.user.id}-${reserved.instruction!.assetId}-${reserved.instruction!.objectPath}`,
          ),
        onProgress: (sent, total) =>
          setProgress(Math.round((sent / total) * 100)),
        onError: (error) => {
          setIsUploading(false);
          setMessage(
            `Upload paused: ${error.message}. Retry to continue the same private upload, or cancel it safely.`,
          );
        },
        onSuccess: async () => {
          activeUpload.current = null;
          activeAssetId.current = null;
          setHasActiveUpload(false);
          setIsUploading(false);
          const result = await completeUpload(reserved.instruction!.assetId);
          setProgress(0);
          if (result.error) {
            setMessage(result.error);
            return;
          }
          setMessage(
            generatedPeaks.current
              ? "Upload complete. Lossless source verification is queued; its waveform is prepared for the persisted-peaks step."
              : "Upload complete.",
          );
          generatedPeaks.current = null;
          setVerificationKickDelayed(Boolean(result.kickDelayed));
          setVerificationAssetId(reserved.instruction!.assetId);
        },
      });
      activeUpload.current = upload;
      const previous = await upload.findPreviousUploads();
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      setIsPreparingUpload(false);
      upload.start();
    } catch (error) {
      const assetId = activeAssetId.current;
      if (assetId) {
        await activeUpload.current?.abort(true);
        await cancelUpload(assetId);
        activeUpload.current = null;
        activeAssetId.current = null;
        setHasActiveUpload(false);
      }
      setIsPreparingUpload(false);
      setIsUploading(false);
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function cancelActiveUpload() {
    const upload = activeUpload.current;
    const assetId = activeAssetId.current;
    if (!upload || !assetId) return;
    await upload.abort(true);
    activeUpload.current = null;
    activeAssetId.current = null;
    setHasActiveUpload(false);
    setIsUploading(false);
    await cancelUpload(assetId);
    generatedPeaks.current = null;
    setMessage("Upload cancelled; reserved capacity was released.");
    setProgress(0);
  }

  function retryActiveUpload() {
    if (!activeUpload.current) return;
    setIsUploading(true);
    setMessage("Resuming direct private upload...");
    activeUpload.current.start();
  }

  const busy =
    isPreparingUpload || isUploading || isConverting || hasActiveUpload;

  return (
    <section className="rounded-card border-subtle bg-surface border p-5">
      <h2 className="text-xl font-semibold">Upload a source</h2>
      <p className="text-muted mt-2 text-sm">
        WAV, FLAC, or MP3 / 45 MiB / 10 minutes. Checks in your browser are
        preliminary.
      </p>
      <p className="text-muted mt-2 max-w-2xl text-sm">
        WAV files can be converted to an equally lossless FLAC before upload,
        often with fewer bytes. The FLAC becomes the canonical source and
        download; Jam Session does not retain a duplicate of the selected WAV.
        FLAC and MP3 files pass through unchanged.
      </p>
      <label className="mt-4 block">
        <span className="sr-only">Choose source audio</span>
        <input
          type="file"
          accept=".wav,.flac,.mp3,audio/wav,audio/flac,audio/mpeg"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void selectFile(file);
          }}
        />
      </label>
      {pendingWav && !isConverting && (
        <div className="border-subtle bg-surface-raised mt-4 rounded-2xl border p-4">
          <p className="font-medium">{pendingWav.file.name}</p>
          <p className="text-muted mt-1 text-sm">
            Lossless optimization changes the stored container from WAV to FLAC,
            not the decoded audio quality.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold disabled:opacity-50"
              type="button"
              disabled={Boolean(pendingWav.capabilityReason)}
              onClick={() => void optimizePendingWav()}
            >
              <FiCheck aria-hidden /> Optimize losslessly
            </button>
            <button
              className="border-strong inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-semibold"
              type="button"
              onClick={() => {
                const file = pendingWav.file;
                setPendingWav(null);
                void startUpload(file, null);
              }}
            >
              <FiUploadCloud aria-hidden /> Upload original WAV
            </button>
          </div>
        </div>
      )}
      {isConverting && (
        <progress
          aria-label="Lossless optimization progress"
          className="mt-4 w-full"
          max="1"
          value={conversionProgress}
        >
          {Math.round(conversionProgress * 100)}%
        </progress>
      )}
      {isUploading && progress > 0 && (
        <progress
          aria-label="Upload progress"
          className="mt-4 w-full"
          max="100"
          value={progress}
        >
          {progress}%
        </progress>
      )}
      <p className="mt-3 text-sm" aria-live="polite">
        {message}
        {isConverting && conversionProgress > 0
          ? ` ${Math.round(conversionProgress * 100)}%`
          : isUploading && progress > 0
            ? ` ${progress}%`
            : ""}
      </p>
      {verificationAssetId && (
        <AssetVerificationStatus
          assetId={verificationAssetId}
          initialState={verificationKickDelayed ? "delayed" : "queued"}
        />
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {isConverting && (
          <button
            className="border-strong inline-flex min-h-11 items-center gap-2 rounded-full border px-4"
            type="button"
            onClick={() => conversionAbort.current?.abort()}
          >
            <FiX aria-hidden /> Cancel optimization
          </button>
        )}
        {hasActiveUpload && !isUploading && (
          <button
            className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold"
            type="button"
            onClick={retryActiveUpload}
          >
            Retry upload
          </button>
        )}
        {hasActiveUpload && (
          <button
            className="border-strong inline-flex min-h-11 items-center gap-2 rounded-full border px-4"
            type="button"
            onClick={() => void cancelActiveUpload()}
          >
            <FiX aria-hidden /> Cancel upload
          </button>
        )}
      </div>
    </section>
  );
}

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
