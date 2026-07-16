"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { VersionedWorkspaceManifest } from "../manifest/schema";
import type { MidiStemVersion } from "@/features/midi/stems/types";
import type { ManifestV3 } from "../manifest/v3";
import type { StudioPatternVersion } from "../midi-adapter/manifest-v3-editor";
import { StudioSkeleton } from "./studio-skeleton";
import type {
  WorkspaceAssetOption,
  WorkspaceInstrumentOption,
} from "@/features/workspaces/types";

const MidiStudioSurface = dynamic(
  () =>
    import("../midi-adapter/midi-studio-surface.client").then(
      (module) => module.MidiStudioSurface,
    ),
  { ssr: false, loading: () => <StudioSkeleton /> },
);

type CommonProps = {
  viewerId: string;
  projectId: string;
  projectTitle: string;
  manifest: VersionedWorkspaceManifest | ManifestV3;
  projectTimeSignature?: { numerator: number; denominator: number };
  durationMs: number;
  midiVersions?: MidiStemVersion[];
  patternVersions?: StudioPatternVersion[];
  tracks: Array<{
    trackId: string;
    kind?: "audio" | "midi";
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
        baseRevisionId: string | null;
        currentRevisionId: string | null;
        currentRevisionNumber: number | null;
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
      performance.mark("jam-session:studio:route-start");
      routeMarked.current = true;
    }
    const timer = window.setTimeout(() => setSupport(getStudioSupport()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (support === "checking") return <StudioSkeleton />;
  if (support !== "ready")
    return (
      <div className="rounded-card border-strong bg-surface border p-6">
        <p role="alert" className="text-muted">
          {support}
        </p>
      </div>
    );
  return props.manifest.manifestVersion === 2 ||
    props.manifest.manifestVersion === 3 ? (
    <MidiStudioSurface {...props} manifest={props.manifest} />
  ) : (
    <div className="rounded-card border-strong bg-surface border p-6">
      <p role="alert" className="text-muted">
        This legacy audio workspace cannot open in the MIDI-only Studio.
      </p>
    </div>
  );
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
