"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { WorkspaceManifestV1 } from "../manifest/schema";
import type {
  WorkspaceAssetOption,
  WorkspaceInstrumentOption,
} from "@/features/workspaces/types";

const StudioSurface = dynamic(
  () =>
    import("../waveform-playlist-adapter/studio-surface").then(
      (module) => module.StudioSurface,
    ),
  { ssr: false, loading: () => <p role="status">Loading studio controls…</p> },
);

type CommonProps = {
  projectId: string;
  projectTitle: string;
  manifest: WorkspaceManifestV1;
  durationMs: number;
  tracks: Array<{
    trackId: string;
    instrumentName: string | null;
    creditName: string;
  }>;
};

export type StudioLauncherProps = CommonProps &
  (
    | { mode: "revision"; revisionId: string; revisionNumber: number }
    | {
        mode: "workspace";
        viewerId: string;
        workspaceId: string;
        baseRevisionId: string;
        currentRevisionId: string;
        currentRevisionNumber: number;
        lockVersion: number;
        manifestSha256: string;
        updatedAt: string;
        assets: WorkspaceAssetOption[];
        instruments: WorkspaceInstrumentOption[];
      }
  );

export function StudioLauncher(props: StudioLauncherProps) {
  const [opened, setOpened] = useState(false);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  if (!opened)
    return (
      <div className="rounded-card border-strong border p-6">
        <p className="text-muted">
          Audio remains private and unloaded until you open the studio.
        </p>
        {unsupported && (
          <p role="alert" className="mt-3">
            {unsupported}
          </p>
        )}
        <button
          className="bg-accent rounded-control mt-5 min-h-11 px-5 font-semibold text-slate-950"
          type="button"
          onClick={() => {
            if (
              window.innerWidth < 768 ||
              !window.matchMedia("(pointer: fine)").matches
            )
              return setUnsupported(
                "The studio currently requires a desktop-sized screen and precise pointer.",
              );
            if (!window.isSecureContext && location.hostname !== "localhost")
              return setUnsupported(
                "Open the studio over a secure HTTPS connection.",
              );
            if (
              !("AudioContext" in window) ||
              !("OfflineAudioContext" in window) ||
              !("AbortController" in window)
            )
              return setUnsupported(
                "This browser does not support the audio features required by the studio.",
              );
            setOpened(true);
          }}
        >
          Open studio
        </button>
      </div>
    );
  return <StudioSurface {...props} />;
}
