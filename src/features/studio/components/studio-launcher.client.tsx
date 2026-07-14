"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceManifestV1 } from "../manifest/schema";
import {
  markStudioPerformance,
  studioPerformanceMarks,
} from "../waveform-playlist-adapter/performance-marks.client";
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
  viewerId: string;
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
        mode: "contributionVersion";
        contributionId: string;
        versionId: string;
        versionNumber: number;
      }
    | {
        mode: "workspace";
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
    | {
        mode: "contribution";
        contributionId: string;
        contributionTitle: string;
        contributionStatus:
          | "draft"
          | "submitted"
          | "changes_requested"
          | "accepted"
          | "rejected"
          | "withdrawn";
        canEdit: boolean;
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
  const routeMarked = useRef(false);
  const [support, setSupport] = useState<"checking" | "ready" | string>(
    "checking",
  );
  useEffect(() => {
    if (!routeMarked.current) {
      markStudioPerformance(studioPerformanceMarks.routeStart);
      routeMarked.current = true;
    }
    const timer = window.setTimeout(() => setSupport(getStudioSupport()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (support !== "ready")
    return (
      <div className="rounded-card border-strong bg-surface border p-6">
        <p
          role={support === "checking" ? "status" : "alert"}
          className="text-muted"
        >
          {support === "checking" ? "Preparing studio controls…" : support}
        </p>
      </div>
    );
  return <StudioSurface {...props} />;
}

function getStudioSupport(): "ready" | string {
  if (window.innerWidth < 768 || !window.matchMedia("(pointer: fine)").matches)
    return "The studio currently requires a desktop-sized screen and precise pointer.";
  if (!window.isSecureContext && location.hostname !== "localhost")
    return "Open the studio over a secure HTTPS connection.";
  if (
    !("AudioContext" in window) ||
    !("OfflineAudioContext" in window) ||
    !("AbortController" in window)
  )
    return "This browser does not support the audio features required by the studio.";
  return "ready";
}
