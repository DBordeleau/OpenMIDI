"use client";
import { useEffect, useRef, useState } from "react";
import { Upload } from "tus-js-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSupabasePublicEnv } from "@/lib/env/public";
import { cancelUpload, completeUpload, reserveUpload } from "./actions";
import { preflightSourceFile } from "./schema";

export function SourceUpload() {
  const [message, setMessage] = useState("Select a source file to begin.");
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const active = useRef<Upload | null>(null);
  useEffect(
    () => () => {
      void active.current?.abort();
    },
    [],
  );
  async function start(file: File) {
    try {
      setMessage("Checking file…");
      const hint = await preflightSourceFile(file);
      const requestId = crypto.randomUUID();
      const reserved = await reserveUpload({ ...hint, requestId });
      if (!reserved.instruction) throw new Error(reserved.error);
      const db = createSupabaseBrowserClient();
      const { data } = await db.auth.getSession();
      if (!data.session)
        throw new Error("Your session expired. Sign in again.");
      setMessage("Uploading directly to private storage…");
      setIsUploading(true);
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
            `Upload paused: ${error.message}. Choose the same file to retry.`,
          );
        },
        onSuccess: async () => {
          active.current = null;
          setIsUploading(false);
          const result = await completeUpload(reserved.instruction!.assetId);
          setMessage(
            result.error
              ? result.error
              : "Uploaded; awaiting trusted verification.",
          );
        },
      });
      active.current = upload;
      const previous = await upload.findPreviousUploads();
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    } catch (error) {
      setIsUploading(false);
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }
  async function cancel() {
    const upload = active.current;
    if (!upload) return;
    await upload.abort(true);
    active.current = null;
    setIsUploading(false);
    const id = upload.options.metadata?.objectName?.split("/")[1];
    if (id) await cancelUpload(id);
    setMessage("Upload cancelled; reserved capacity was released.");
    setProgress(0);
  }
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-xl font-semibold">Upload a source</h2>
      <p className="mt-2 text-sm text-zinc-300">
        WAV, FLAC, or MP3 · 45 MiB · 10 minutes. Checks in your browser are
        preliminary.
      </p>
      <label className="mt-4 block">
        <span className="sr-only">Choose source audio</span>
        <input
          type="file"
          accept=".wav,.flac,.mp3,audio/wav,audio/flac,audio/mpeg"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void start(file);
          }}
        />
      </label>
      {progress > 0 && (
        <progress className="mt-4 w-full" max="100" value={progress}>
          {progress}%
        </progress>
      )}
      <p className="mt-3 text-sm" aria-live="polite">
        {message}
        {progress > 0 ? ` ${progress}%` : ""}
      </p>
      {isUploading && (
        <button
          className="mt-3 rounded-lg border px-3 py-2"
          type="button"
          onClick={() => void cancel()}
        >
          Cancel upload
        </button>
      )}
    </section>
  );
}
