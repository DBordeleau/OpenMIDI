"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import type { MidiStemVersion } from "@/features/midi/stems/types";
import type { ManifestV3 } from "../manifest/v3";
import { staleOwnerDraftSchema } from "../session-contract";
import type { StudioPatternVersion } from "../midi-adapter/manifest-v3-editor";
import { StudioSkeleton } from "./studio-skeleton";

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
  manifest: ManifestV3;
  projectTimeSignature?: { numerator: number; denominator: number };
  durationMs: number;
  midiVersions?: MidiStemVersion[];
  patternVersions?: StudioPatternVersion[];
  tracks: Array<{
    trackId: string;
    instrumentName: string | null;
    creditName: string;
  }>;
  initialEditorClipId?: string;
};

export type StaleOwnerDraft = z.infer<typeof staleOwnerDraftSchema>;

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
        staleDraft: StaleOwnerDraft | null;
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
      }
  );

export function StudioLauncher(props: StudioLauncherProps) {
  const routeMarked = useRef(false);
  const [support, setSupport] = useState<"checking" | "ready" | string>(
    "checking",
  );
  useEffect(() => {
    if (!routeMarked.current) {
      performance.mark("openmidi:studio:route-start");
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
  return <MidiStudioSurface {...props} manifest={props.manifest} />;
}

function getStudioSupport(): "ready" | string {
  if (window.innerWidth < 768 || !window.matchMedia("(pointer: fine)").matches)
    return "The studio currently requires a desktop-sized screen and precise pointer.";
  if (!window.isSecureContext && location.hostname !== "localhost")
    return "Open the studio over a secure HTTPS connection.";
  if (!("AudioContext" in window) || !("OfflineAudioContext" in window))
    return "This browser does not support the MIDI synthesis features required by the studio.";
  return "ready";
}
