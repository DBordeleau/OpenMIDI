"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiChevronDown,
  FiDownload,
  FiFolderPlus,
  FiMusic,
} from "react-icons/fi";
import type { StudioLauncherProps } from "../components/studio-launcher.client";
import { useStudioLifecycleRegistration } from "../components/studio-shell.client";
import {
  MIDI_PPQ,
  parseWorkspaceManifestV2,
  type MidiTrackV2,
  type WorkspaceManifestV2,
  type WorkspaceTrackV2,
} from "../manifest/v2";
import {
  toEditorManifest,
  toEditorPatternVersion,
  toWorkspaceManifestV3,
} from "./manifest-v3-editor";
import { BrowserMidiRuntime } from "./browser-midi-runtime.client";
import { projectMidiSchedule } from "@/features/midi/scheduler";
import { INSTRUMENT_PRESETS_CATALOG_1 } from "@/features/midi/presets";
import {
  exportStudioMidiV3,
  renderStudioWavV3,
} from "./local-export-v3.client";
import { sanitizeFilenamePart } from "@/features/exports/filename";
import { sha256PostgresJsonb } from "../manifest/canonical-json";
import {
  publishMidiWorkspaceV3Action,
  saveMidiWorkspaceV3Action,
} from "@/features/workspaces/actions";
import {
  clearMidiLocalRecovery,
  readMidiLocalRecovery,
  writeMidiLocalRecovery,
} from "@/features/workspaces/midi-local-recovery.client";
import type { MidiLocalRecoveryEnvelope } from "@/features/workspaces/schema";
import { MutableStudioLifecycle } from "../switch-coordinator";
import { ArrangerWorkspace } from "../arranger/arranger-workspace";
import {
  applyArrangementCommand,
  ArrangementCommandError,
  type ArrangementCommand,
} from "../arranger/commands";
import {
  commitArrangementHistory,
  createArrangementHistory,
  redoArrangement,
  undoArrangement,
} from "../arranger/history";
import {
  IntegratedMidiComposer,
  type IntegratedMidiTarget,
} from "../integrated-midi/integrated-midi-composer.client";
import { freezeStudioPatternAction } from "../integrated-midi/actions";
import type { FinalizePatternInput } from "../integrated-midi/integrated-midi-composer.client";
import type { MidiDraftSaveStatus } from "@/features/midi/stems/draft-autosave";

type Props = StudioLauncherProps;
type SaveStatus =
  "saved" | "dirty" | "saving" | "offline" | "conflict" | "error";

const button =
  "border-strong hover:border-accent inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold disabled:opacity-50";
const input =
  "border-strong bg-canvas min-h-11 rounded-control border px-3 text-sm";
const toolbarButton =
  "border-strong text-muted hover:border-accent hover:text-accent inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-40";

export function MidiStudioSurface(props: Props) {
  const reduce = useReducedMotion();
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  // Point the arranger↔editor morph originates from, as a `transform-origin`
  // string. Set to the clicked clip so the editor appears to bloom out of it.
  const [editorOrigin, setEditorOrigin] = useState("50% 38%");
  const [midiVersions, setMidiVersions] = useState(() => [
    ...(props.patternVersions ?? []).map(toEditorPatternVersion),
    ...(props.midiVersions ?? []),
  ]);
  const editable =
    props.mode === "workspace"
      ? props
      : props.mode === "contribution" && props.canEdit
        ? props
        : null;
  const initialManifest = toEditorManifest(props.manifest);
  const v3Authority = {
    workspaceId:
      props.manifest.workspaceId ??
      (props.mode === "workspace" || props.mode === "contribution"
        ? props.workspaceId
        : props.projectId),
    musicalKey: props.manifest.musicalKey,
  };
  const [manifest, setManifest] = useState(initialManifest);
  const manifestRef = useRef(initialManifest);
  const historyRef = useRef(createArrangementHistory(initialManifest));
  const [historyAvailability, setHistoryAvailability] = useState({
    canUndo: false,
    canRedo: false,
  });
  const [lockVersion, setLockVersion] = useState(editable?.lockVersion ?? 0);
  const lockVersionRef = useRef(editable?.lockVersion ?? 0);
  const [baseRevisionId, setBaseRevisionId] = useState(
    editable?.baseRevisionId ?? null,
  );
  const baseRevisionIdRef = useRef(editable?.baseRevisionId ?? null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState(
    midiVersions[0]?.stemVersionId ?? "",
  );
  const [playing, setPlaying] = useState(false);
  const [seekTick, setSeekTick] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [composerTarget, setComposerTarget] =
    useState<IntegratedMidiTarget | null>(null);
  const [pendingMidiLane, setPendingMidiLane] = useState<{
    trackId: string;
    name: string;
  } | null>(null);
  const [finalizedClip, setFinalizedClip] = useState<{
    trackId: string;
    clipId: string;
    token: number;
  } | null>(null);
  const [draftSaveStatus, setDraftSaveStatus] =
    useState<MidiDraftSaveStatus>("saved");
  const [integratedDraftActive, setIntegratedDraftActive] = useState(false);
  const [recovery, setRecovery] = useState<MidiLocalRecoveryEnvelope | null>(
    () =>
      editable
        ? readMidiLocalRecovery(editable.viewerId, editable.workspaceId)
        : null,
  );
  const runtime = useRef<BrowserMidiRuntime | null>(null);
  const playbackTimer = useRef<number | null>(null);
  const playbackStartTimer = useRef<number | null>(null);
  const autosaveTimer = useRef<number | null>(null);
  const saveInFlight = useRef(false);
  const persistRef = useRef<(next: WorkspaceManifestV2) => Promise<boolean>>(
    async () => false,
  );
  const generation = useRef(0);
  const acknowledgedGeneration = useRef(0);
  const finalizeIntentRef = useRef<{
    draftId: string;
    patternRequestId: string;
    versionRequestId: string;
    trackId: string;
    clipId: string;
  } | null>(null);
  const [lifecycle] = useState(
    () =>
      new MutableStudioLifecycle({
        status: "saved",
        generation: 0,
        acknowledgedGeneration: 0,
        recoveryAvailable: false,
      }),
  );
  const stemVersions = useMemo(
    () =>
      new Map(midiVersions.map((version) => [version.stemVersionId, version])),
    [midiVersions],
  );
  const arrangementContext = useMemo(
    () => ({
      midiVersionDurations: new Map(
        midiVersions.map((version) => [
          version.stemVersionId,
          version.durationTicks,
        ]),
      ),
    }),
    [midiVersions],
  );

  useEffect(() => {
    if (!importMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest("[data-import-menu]"))
        setImportMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImportMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [importMenuOpen]);

  useEffect(() => {
    const next = new BrowserMidiRuntime();
    runtime.current = next;
    return () => {
      if (playbackStartTimer.current) clearTimeout(playbackStartTimer.current);
      if (playbackTimer.current) cancelAnimationFrame(playbackTimer.current);
      next.dispose();
      if (runtime.current === next) runtime.current = null;
    };
  }, [props.projectId]);

  useEffect(() => {
    const next = runtime.current;
    if (!next) return;
    try {
      const schedule = projectMidiSchedule({ manifest, stemVersions });
      void next
        .prepare(schedule)
        .catch(() =>
          setMessage("Some local Studio instruments could not be prepared."),
        );
    } catch {
      // Draft timing is validated and reported by the explicit save/play action.
    }
  }, [manifest, stemVersions]);

  useEffect(() => {
    const pauseForOtherPlayer = (event: Event) => {
      const instanceId = (event as CustomEvent<{ instanceId?: string }>).detail
        ?.instanceId;
      if (instanceId !== `studio:${props.projectId}`) {
        runtime.current?.pause();
        setPlaying(false);
      }
    };
    window.addEventListener("jam-session:preview-play", pauseForOtherPlayer);
    return () =>
      window.removeEventListener(
        "jam-session:preview-play",
        pauseForOtherPlayer,
      );
  }, [props.projectId]);

  const cacheRecovery = useCallback(
    async (
      next: WorkspaceManifestV2,
      state: MidiLocalRecoveryEnvelope["state"] = "pending",
    ) => {
      if (!editable) return false;
      return writeMidiLocalRecovery({
        version: 2,
        viewerId: editable.viewerId,
        projectId: editable.projectId,
        workspaceId: editable.workspaceId,
        baseRevisionId: baseRevisionIdRef.current,
        serverLockVersion: lockVersionRef.current,
        manifest: next,
        manifestSha256: await sha256PostgresJsonb(next),
        savedAt: new Date().toISOString(),
        state,
      });
    },
    [editable],
  );

  const changeManifest = (
    next: WorkspaceManifestV2,
    group: string | null = null,
    recordHistory = true,
  ) => {
    historyRef.current = recordHistory
      ? commitArrangementHistory(historyRef.current, next, group)
      : { ...historyRef.current, present: next, group: null };
    setHistoryAvailability({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    });
    generation.current += 1;
    manifestRef.current = next;
    setManifest(next);
    setStatus("dirty");
    setMessage(null);
    lifecycle.update({
      status: "dirty",
      generation: generation.current,
      acknowledgedGeneration: acknowledgedGeneration.current,
      recoveryAvailable: true,
    });
    void cacheRecovery(next);
    scheduleAutosave(next);
  };

  function scheduleAutosave(next: WorkspaceManifestV2) {
    if (!editable) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null;
      void persistRef.current(next);
    }, 900);
  }

  function runArrangementCommand(
    command: ArrangementCommand,
    group: string | null = null,
  ) {
    if (!editable) return false;
    try {
      changeManifest(
        applyArrangementCommand(
          manifestRef.current,
          command,
          arrangementContext,
        ),
        group,
      );
      return true;
    } catch (error) {
      setMessage(
        error instanceof ArrangementCommandError
          ? error.message
          : "That arrangement edit could not be applied.",
      );
      return false;
    }
  }

  function undo() {
    const next = undoArrangement(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    changeManifest(next.present, null, false);
    setMessage("Last arrangement edit undone in this private draft.");
  }

  function redo() {
    const next = redoArrangement(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    changeManifest(next.present, null, false);
    setMessage("Arrangement edit redone in this private draft.");
  }

  async function persist(next = manifest) {
    if (!editable) return false;
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (saveInFlight.current) {
      scheduleAutosave(manifestRef.current);
      return false;
    }
    saveInFlight.current = true;
    const saveGeneration = generation.current;
    let canonical: WorkspaceManifestV2;
    try {
      canonical = parseWorkspaceManifestV2(next);
    } catch {
      setStatus("error");
      setMessage("Check clip timing and mixer values before saving.");
      lifecycle.update({
        status: "error",
        generation: generation.current,
        acknowledgedGeneration: acknowledgedGeneration.current,
        recoveryAvailable: await cacheRecovery(next),
      });
      saveInFlight.current = false;
      return false;
    }
    if (!navigator.onLine) {
      setStatus("offline");
      setMessage("Offline — changes remain on this device.");
      lifecycle.update({
        status: "offline",
        generation: generation.current,
        acknowledgedGeneration: acknowledgedGeneration.current,
        recoveryAvailable: await cacheRecovery(canonical),
      });
      saveInFlight.current = false;
      return false;
    }
    setStatus("saving");
    lifecycle.update({
      status: "saving",
      generation: generation.current,
      acknowledgedGeneration: acknowledgedGeneration.current,
      recoveryAvailable: true,
    });
    let result: Awaited<ReturnType<typeof saveMidiWorkspaceV3Action>>;
    try {
      result = await saveMidiWorkspaceV3Action({
        workspaceId: editable.workspaceId,
        requestId: crypto.randomUUID(),
        expectedLockVersion: lockVersionRef.current,
        manifest: toWorkspaceManifestV3(canonical, v3Authority),
      });
    } catch {
      setStatus("error");
      setMessage("The arrangement could not be saved. Try again.");
      lifecycle.update({
        status: "error",
        generation: generation.current,
        acknowledgedGeneration: acknowledgedGeneration.current,
        recoveryAvailable: await cacheRecovery(canonical),
      });
      saveInFlight.current = false;
      return false;
    }
    if (!result.ok) {
      setStatus(result.code === "conflict" ? "conflict" : "error");
      setMessage(
        result.code === "conflict"
          ? "This workspace changed in another session. Reload before replacing an exact pattern version."
          : "The arrangement could not be saved.",
      );
      const recoveryAvailable = await cacheRecovery(
        canonical,
        result.code === "conflict" ? "conflict" : "pending",
      );
      lifecycle.update({
        status: result.code === "conflict" ? "conflict" : "error",
        generation: generation.current,
        acknowledgedGeneration: acknowledgedGeneration.current,
        recoveryAvailable,
      });
      saveInFlight.current = false;
      return false;
    }
    lockVersionRef.current = result.lockVersion;
    setLockVersion(result.lockVersion);
    acknowledgedGeneration.current = Math.max(
      acknowledgedGeneration.current,
      saveGeneration,
    );
    const fullySaved = generation.current === saveGeneration;
    if (fullySaved) {
      historyRef.current = {
        ...historyRef.current,
        present: canonical,
        group: null,
      };
      manifestRef.current = canonical;
      setManifest(canonical);
      setHistoryAvailability({
        canUndo: historyRef.current.past.length > 0,
        canRedo: historyRef.current.future.length > 0,
      });
    }
    setStatus(fullySaved ? "saved" : "dirty");
    setMessage(fullySaved ? "Arrangement saved." : null);
    if (fullySaved) {
      clearMidiLocalRecovery(editable.viewerId, editable.workspaceId);
      setRecovery(null);
    } else {
      await cacheRecovery(manifestRef.current);
    }
    lifecycle.update({
      status: fullySaved ? "saved" : "dirty",
      generation: generation.current,
      acknowledgedGeneration: acknowledgedGeneration.current,
      recoveryAvailable: !fullySaved,
    });
    saveInFlight.current = false;
    if (!fullySaved) scheduleAutosave(manifestRef.current);
    return true;
  }
  useEffect(() => {
    persistRef.current = persist;
  });

  async function importVersion() {
    const version = stemVersions.get(selectedVersionId);
    if (!version || !editable || manifest.tracks.length >= 16) return;
    const trackId = crypto.randomUUID();
    const track: MidiTrackV2 = {
      kind: "midi",
      trackId,
      name: version.name,
      instrumentId: null,
      presetId: version.defaultPresetId,
      presetVersion: version.defaultPresetVersion,
      gainDb: 0,
      pan: 0,
      muted: false,
      soloed: false,
      sortOrder: manifest.tracks.length,
      clips: [
        {
          clipId: crypto.randomUUID(),
          midiStemVersionId: version.stemVersionId,
          startTick: 0,
          durationTicks: version.durationTicks,
          sourceStartTick: 0,
          loop: false,
        },
      ],
    };
    const next = parseWorkspaceManifestV2({
      ...manifest,
      durationTicks: Math.max(manifest.durationTicks, version.durationTicks),
      tracks: [...manifest.tracks, track],
    });
    changeManifest(next);
    await persist(next);
  }

  function replaceVersion(
    trackId: string,
    clipIdOrVersionId: string,
    requestedVersionId?: string,
  ) {
    const track = manifestRef.current.tracks.find(
      (candidate) => candidate.trackId === trackId && candidate.kind === "midi",
    );
    const clipId = requestedVersionId
      ? clipIdOrVersionId
      : track?.clips[0]?.clipId;
    const stemVersionId = requestedVersionId ?? clipIdOrVersionId;
    if (!clipId) return;
    runArrangementCommand({
      type: "replaceMidiVersion",
      trackId,
      clipId,
      midiStemVersionId: stemVersionId,
    });
  }

  function originFromElement(element: Element | null) {
    const stage = stageRef.current;
    if (!element || !stage) return "50% 38%";
    const stageRect = stage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return "50% 38%";
    const rect = element.getBoundingClientRect();
    const clamp = (value: number) => Math.max(0, Math.min(100, value));
    const x =
      ((rect.left + rect.width / 2 - stageRect.left) / stageRect.width) * 100;
    const y =
      ((rect.top + rect.height / 2 - stageRect.top) / stageRect.height) * 100;
    return `${clamp(x)}% ${clamp(y)}%`;
  }

  function openMidiClipEditor(trackId: string, clipId: string) {
    if (!editable) return;
    const track = manifestRef.current.tracks.find(
      (candidate) => candidate.trackId === trackId && candidate.kind === "midi",
    );
    const clip = track?.clips.find((candidate) => candidate.clipId === clipId);
    if (!clip || !("midiStemVersionId" in clip)) {
      setMessage("That exact MIDI clip is not available to edit.");
      return;
    }
    const version = clip ? stemVersions.get(clip.midiStemVersionId) : undefined;
    if (!clip || !version) {
      setMessage("That exact MIDI clip is not available to edit.");
      return;
    }
    setEditorOrigin(
      originFromElement(document.querySelector(`[data-clip-id="${clipId}"]`)),
    );
    setComposerTarget({
      operation: "replace",
      trackId,
      clipId,
      version,
      startTick: clip.startTick,
    });
    setDraftSaveStatus("saved");
  }

  const startPlaybackMonitor = useCallback(() => {
    if (playbackTimer.current)
      window.cancelAnimationFrame(playbackTimer.current);
    const updatePlayhead = () => {
      const snapshot = runtime.current?.getTransportSnapshot();
      if (!snapshot || snapshot.state !== "playing") {
        playbackTimer.current = null;
        if (snapshot) {
          const current = manifestRef.current;
          setSeekTick(
            Math.round(
              (snapshot.positionSeconds * current.tempoBpm * MIDI_PPQ) / 60,
            ),
          );
        }
        setPlaying(false);
        return;
      }
      const current = manifestRef.current;
      const nextTick = Math.round(
        (snapshot.positionSeconds * current.tempoBpm * MIDI_PPQ) / 60,
      );
      if (nextTick >= current.durationTicks) {
        runtime.current?.pause();
        playbackTimer.current = null;
        setPlaying(false);
        setSeekTick(0);
        return;
      }
      setSeekTick(nextTick);
      playbackTimer.current = requestAnimationFrame(updatePlayhead);
    };
    playbackTimer.current = requestAnimationFrame(updatePlayhead);
  }, []);

  const stopProjectTransport = useCallback(() => {
    if (playbackStartTimer.current) {
      window.clearTimeout(playbackStartTimer.current);
      playbackStartTimer.current = null;
    }
    if (playbackTimer.current) {
      window.cancelAnimationFrame(playbackTimer.current);
      playbackTimer.current = null;
    }
    runtime.current?.pause();
    setPlaying(false);
  }, []);

  const startProjectTransport = useCallback(
    (startTick: number, countInSeconds: number) => {
      stopProjectTransport();
      setSeekTick(startTick);
      playbackStartTimer.current = window.setTimeout(() => {
        playbackStartTimer.current = null;
        const current = manifestRef.current;
        const fromSeconds = (startTick * 60) / (current.tempoBpm * MIDI_PPQ);
        void runtime.current
          ?.play(fromSeconds)
          .then(() => {
            setPlaying(true);
            startPlaybackMonitor();
          })
          .catch(() =>
            setMessage("Project playback could not join the MIDI audition."),
          );
      }, countInSeconds * 1_000);
    },
    [startPlaybackMonitor, stopProjectTransport],
  );

  const finalizeIntegratedDraft = useCallback(
    async (input: FinalizePatternInput, target: IntegratedMidiTarget) => {
      if (!editable || status !== "saved")
        return {
          ok: false,
          message: "Save the arrangement before applying this MIDI version.",
        };
      let intent = finalizeIntentRef.current;
      if (!intent || intent.draftId !== input.draftId) {
        intent = {
          draftId: input.draftId,
          patternRequestId: crypto.randomUUID(),
          versionRequestId: crypto.randomUUID(),
          trackId: target.trackId,
          clipId:
            target.operation === "replace"
              ? target.clipId
              : crypto.randomUUID(),
        };
        finalizeIntentRef.current = intent;
      }
      const result = await freezeStudioPatternAction({
        patternRequestId: intent.patternRequestId,
        versionRequestId: intent.versionRequestId,
        name: input.content.name,
        existingPatternId:
          target.operation === "replace" &&
          target.version.creatorId === props.viewerId
            ? target.version.stemId
            : null,
        expectedVersionNumber:
          target.operation === "replace" &&
          target.version.creatorId === props.viewerId
            ? target.version.version + 1
            : 1,
        sourcePatternVersionId:
          target.operation === "replace" &&
          target.version.creatorId !== props.viewerId
            ? target.version.stemVersionId
            : null,
        content: {
          ppq: input.content.ppq,
          durationTicks: input.content.durationTicks,
          notes: input.content.notes,
        },
      });
      if (!result.ok)
        return {
          ok: false,
          message: "The pattern could not be frozen. Retry when ready.",
        };
      const editorVersion = toEditorPatternVersion({
        ...result.version,
        name: input.content.name,
        presetId: input.content.presetId,
        presetVersion: input.content.presetVersion,
      });
      const current = manifestRef.current;
      const next = parseWorkspaceManifestV2({
        ...current,
        durationTicks: Math.max(
          current.durationTicks,
          target.startTick + result.version.durationTicks,
        ),
        tracks:
          target.operation === "add"
            ? [
                ...current.tracks,
                {
                  kind: "midi" as const,
                  trackId: intent.trackId,
                  name: input.content.name,
                  instrumentId: null,
                  presetId: input.content.presetId,
                  presetVersion: input.content.presetVersion,
                  gainDb: 0,
                  pan: 0,
                  muted: false,
                  soloed: false,
                  sortOrder: current.tracks.length,
                  clips: [
                    {
                      clipId: intent.clipId,
                      midiStemVersionId: editorVersion.stemVersionId,
                      startTick: target.startTick,
                      durationTicks: editorVersion.durationTicks,
                      sourceStartTick: 0,
                      loop: false,
                    },
                  ],
                },
              ]
            : current.tracks.map((track) =>
                track.trackId !== target.trackId || track.kind !== "midi"
                  ? track
                  : {
                      ...track,
                      presetId: input.content.presetId,
                      presetVersion: input.content.presetVersion,
                      clips: track.clips.map((clip) =>
                        clip.clipId !== target.clipId
                          ? clip
                          : {
                              ...clip,
                              midiStemVersionId: editorVersion.stemVersionId,
                              durationTicks: editorVersion.durationTicks,
                              sourceStartTick: 0,
                              loop: false,
                            },
                      ),
                    },
              ),
      });
      historyRef.current = commitArrangementHistory(
        historyRef.current,
        next,
        null,
      );
      manifestRef.current = next;
      setManifest(next);
      setMidiVersions((current) => [
        editorVersion,
        ...current.filter(
          (version) => version.stemVersionId !== editorVersion.stemVersionId,
        ),
      ]);
      generation.current += 1;
      setStatus("dirty");
      const saved = await persistRef.current(next);
      if (!saved)
        return {
          ok: false,
          message:
            "The immutable pattern was created, but the arrangement needs to be saved again.",
        };
      setHistoryAvailability({
        canUndo: historyRef.current.past.length > 0,
        canRedo: historyRef.current.future.length > 0,
      });
      clearMidiLocalRecovery(editable.viewerId, editable.workspaceId);
      lifecycle.update({
        status: "saved",
        generation: generation.current,
        acknowledgedGeneration: acknowledgedGeneration.current,
        recoveryAvailable: false,
      });
      finalizeIntentRef.current = null;
      setComposerTarget(null);
      if (target.operation === "add") {
        setPendingMidiLane(null);
        setFinalizedClip({
          trackId: intent.trackId,
          clipId: intent.clipId,
          token: Date.now(),
        });
      }
      setIntegratedDraftActive(false);
      setDraftSaveStatus("saved");
      const outcome =
        target.operation === "replace"
          ? `Pattern version ${result.version.version} is immutable and replaced only the selected clip.`
          : `Pattern version ${result.version.version} is immutable and was added to the arrangement.`;
      setMessage(outcome);
      return { ok: true, message: outcome };
    },
    [editable, lifecycle, props.viewerId, status],
  );

  function updateTrack(trackId: string, patch: Partial<WorkspaceTrackV2>) {
    runArrangementCommand(
      { type: "patchTrack", trackId, patch },
      `${trackId}:${Object.keys(patch).sort().join(",")}`,
    );
  }

  function removeTrack(trackId: string) {
    runArrangementCommand({ type: "removeTrack", trackId });
  }

  function moveTrack(trackId: string, delta: -1 | 1) {
    const ordered = [...manifestRef.current.tracks].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    );
    const index = ordered.findIndex((track) => track.trackId === trackId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    runArrangementCommand({
      type: "reorderTrack",
      trackId,
      targetIndex: target,
    });
  }

  function updateClip(
    trackId: string,
    clipId: string,
    patch: Record<string, number | boolean>,
  ) {
    runArrangementCommand(
      { type: "patchClip", trackId, clipId, patch },
      `${clipId}:${Object.keys(patch).sort().join(",")}`,
    );
  }

  async function togglePlayback() {
    if (playing) {
      runtime.current?.pause();
      const snapshot = runtime.current?.getTransportSnapshot();
      if (snapshot)
        setSeekTick(
          Math.round(
            (snapshot.positionSeconds * manifest.tempoBpm * MIDI_PPQ) / 60,
          ),
        );
      if (playbackTimer.current) cancelAnimationFrame(playbackTimer.current);
      playbackTimer.current = null;
      setPlaying(false);
      return;
    }
    window.dispatchEvent(
      new CustomEvent("jam-session:preview-play", {
        detail: { instanceId: `studio:${props.projectId}` },
      }),
    );
    try {
      const fromSeconds = (seekTick * 60) / (manifest.tempoBpm * MIDI_PPQ);
      await runtime.current?.play(fromSeconds);
      setPlaying(true);
      startPlaybackMonitor();
    } catch {
      setMessage("Playback needs an enabled browser audio context.");
    }
  }

  function download(bytes: Uint8Array | Blob, extension: "mid" | "wav") {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFilenamePart(props.projectTitle, "jam-session")}.${extension}`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function publish() {
    if (
      props.mode !== "workspace" ||
      status !== "saved" ||
      manifest.tracks.length === 0 ||
      composerTarget !== null
    )
      return;
    setMessage("Publishing immutable revision…");
    const result = await publishMidiWorkspaceV3Action(props.projectId, {
      workspaceId: props.workspaceId,
      requestId: crypto.randomUUID(),
      expectedLockVersion: lockVersion,
      expectedBaseRevisionId: baseRevisionId,
      message: null,
    });
    if (!result.ok) {
      setMessage(
        "The revision could not be published. Reload if the project changed.",
      );
      return;
    }
    setBaseRevisionId(result.revisionId);
    baseRevisionIdRef.current = result.revisionId;
    setMessage(
      `Revision ${result.revisionNumber} published with exact pattern and arrangement versions.`,
    );
  }

  useEffect(() => {
    if (!editable) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (generation.current <= acknowledgedGeneration.current) return;
      event.preventDefault();
    };
    const online = () => {
      if (status === "offline") setStatus("dirty");
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("online", online);
    };
  }, [editable, status]);

  useEffect(() => {
    if (!integratedDraftActive) return;
    generation.current += 1;
    lifecycle.update({
      status: draftSaveStatus === "conflict" ? "conflict" : "error",
      generation: generation.current,
      acknowledgedGeneration: acknowledgedGeneration.current,
      recoveryAvailable: true,
    });
  }, [draftSaveStatus, integratedDraftActive, lifecycle]);

  useEffect(
    () => () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    },
    [],
  );

  useEffect(() => {
    lifecycle.configure({
      requestSave: () => void persist(manifestRef.current),
      preserveRecovery: () =>
        cacheRecovery(
          manifestRef.current,
          status === "conflict" ? "conflict" : "pending",
        ),
      dispose: async () => {
        if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
        if (playbackStartTimer.current)
          clearTimeout(playbackStartTimer.current);
        if (playbackTimer.current) cancelAnimationFrame(playbackTimer.current);
        runtime.current?.dispose();
        runtime.current = null;
      },
    });
  });
  useStudioLifecycleRegistration(lifecycle, { editable: Boolean(editable) });

  if (manifest.manifestVersion === 2)
    return (
      <section className="flex min-h-0 flex-1 flex-col gap-4">
        {recovery && editable && (
          <div role="alert" className="rounded-card border-accent border p-5">
            <h2 className="font-bold">
              Pending MIDI changes found on this device
            </h2>
            <p className="text-muted mt-1">
              Restore this local arrangement, or keep the server workspace.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="cta-gradient text-accent-contrast min-h-11 rounded-full px-4 font-semibold"
                onClick={() => {
                  manifestRef.current = recovery.manifest;
                  historyRef.current = createArrangementHistory(
                    recovery.manifest,
                  );
                  setHistoryAvailability({ canUndo: false, canRedo: false });
                  generation.current += 1;
                  setManifest(recovery.manifest);
                  setStatus(
                    recovery.state === "conflict" ? "conflict" : "dirty",
                  );
                  setRecovery(null);
                  lifecycle.update({
                    status:
                      recovery.state === "conflict" ? "conflict" : "dirty",
                    generation: generation.current,
                    acknowledgedGeneration: acknowledgedGeneration.current,
                    recoveryAvailable: true,
                  });
                }}
              >
                Restore pending changes
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  clearMidiLocalRecovery(
                    editable.viewerId,
                    editable.workspaceId,
                  );
                  setRecovery(null);
                }}
              >
                Discard local copy
              </button>
            </div>
          </div>
        )}
        {props.mode === "contribution" && (
          <div className="border-subtle rounded-control border p-4">
            <p className="font-semibold">
              Contribution: {props.contributionTitle}
            </p>
            <p className="text-muted mt-1 text-sm">
              Shape the arrangement here, then return to submit its immutable
              snapshot.
            </p>
            {composerTarget ? (
              <p className="text-muted mt-2 text-sm" role="status">
                Apply or close the MIDI draft before returning to submit.
              </p>
            ) : (
              <Link
                className="text-accent mt-2 inline-block underline"
                href={`/projects/${props.projectId}/contributions/${props.contributionId}`}
              >
                Return to contribution
              </Link>
            )}
          </div>
        )}
        <div ref={stageRef} className="relative flex min-h-0 flex-1 flex-col">
          <motion.div
            className="flex min-h-0 flex-1 flex-col"
            animate={{
              opacity: composerTarget ? 0 : 1,
              scale: reduce ? 1 : composerTarget ? 0.97 : 1,
            }}
            transition={{
              duration: reduce ? 0 : 0.32,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            style={{
              transformOrigin: editorOrigin,
              pointerEvents: composerTarget ? "none" : "auto",
            }}
            inert={composerTarget ? true : undefined}
          >
            <ArrangerWorkspace
              manifest={manifest}
              midiVersions={midiVersions}
              trackCredits={props.tracks}
              editable={Boolean(editable)}
              playing={playing}
              playheadTick={seekTick}
              onTogglePlayback={() => void togglePlayback()}
              onSeek={(tick) => {
                runtime.current?.pause();
                if (playbackTimer.current)
                  cancelAnimationFrame(playbackTimer.current);
                playbackTimer.current = null;
                setPlaying(false);
                setSeekTick(tick);
              }}
              onTrackPatch={updateTrack}
              onClipPatch={updateClip}
              onMoveTrack={moveTrack}
              onRemoveTrack={removeTrack}
              onReplaceVersion={(trackId, clipId, versionId) =>
                void replaceVersion(trackId, clipId, versionId)
              }
              onEditMidiClip={openMidiClipEditor}
              onCommand={runArrangementCommand}
              pendingMidiLane={pendingMidiLane}
              onAddMidiLane={() => {
                setPendingMidiLane({
                  trackId: crypto.randomUUID(),
                  name: `MIDI track ${manifest.tracks.filter(({ kind }) => kind === "midi").length + 1}`,
                });
                setMessage(null);
              }}
              onPendingMidiLaneNameChange={(name) =>
                setPendingMidiLane((current) =>
                  current ? { ...current, name } : current,
                )
              }
              onOpenPendingPianoRoll={() => {
                if (!pendingMidiLane?.name.trim()) return;
                setEditorOrigin("50% 32%");
                setComposerTarget({
                  operation: "add",
                  startTick: seekTick,
                  trackId: pendingMidiLane.trackId,
                  name: pendingMidiLane.name.trim(),
                  entry: "blank",
                });
                setDraftSaveStatus("saved");
              }}
              onImportPendingMidi={(file) => {
                if (!pendingMidiLane?.name.trim()) return;
                setEditorOrigin("50% 32%");
                setComposerTarget({
                  operation: "add",
                  startTick: seekTick,
                  trackId: pendingMidiLane.trackId,
                  name: pendingMidiLane.name.trim(),
                  entry: "import",
                  file,
                });
                setDraftSaveStatus("saved");
              }}
              onClosePendingMidiLane={() => {
                stopProjectTransport();
                setPendingMidiLane(null);
                setComposerTarget(null);
                setIntegratedDraftActive(false);
                finalizeIntentRef.current = null;
              }}
              finalizedClip={finalizedClip}
              canUndo={historyAvailability.canUndo}
              canRedo={historyAvailability.canRedo}
              onUndo={undo}
              onRedo={redo}
              actionRegion={
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className={toolbarButton}
                    title="Export a standard MIDI file"
                    disabled={!manifest.tracks.length}
                    onClick={() =>
                      download(
                        exportStudioMidiV3(
                          toWorkspaceManifestV3(manifest, v3Authority),
                          stemVersions,
                          props.projectTitle,
                        ),
                        "mid",
                      )
                    }
                  >
                    <FiDownload aria-hidden /> .mid
                  </button>
                  <button
                    type="button"
                    className={toolbarButton}
                    title="Render and download a WAV mix locally"
                    disabled={!manifest.tracks.length || rendering}
                    onClick={() =>
                      void (async () => {
                        setRendering(true);
                        try {
                          download(
                            await renderStudioWavV3(
                              toWorkspaceManifestV3(manifest, v3Authority),
                              stemVersions,
                            ),
                            "wav",
                          );
                        } catch (error) {
                          console.error("Local MIDI WAV render failed.", error);
                          setMessage(
                            "The local synth mix could not be rendered in this browser.",
                          );
                        } finally {
                          setRendering(false);
                        }
                      })()
                    }
                  >
                    <FiDownload aria-hidden />{" "}
                    {rendering ? "Rendering…" : "WAV"}
                  </button>
                  {editable && (
                    <div className="relative" data-import-menu>
                      <button
                        type="button"
                        className={toolbarButton}
                        aria-haspopup="menu"
                        aria-expanded={importMenuOpen}
                        title="Reuse an exact pattern version from this project"
                        onClick={() => setImportMenuOpen((open) => !open)}
                      >
                        <FiFolderPlus aria-hidden /> Library
                        <FiChevronDown
                          aria-hidden
                          className={`transition-transform ${importMenuOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      <AnimatePresence>
                        {importMenuOpen && (
                          <motion.div
                            role="menu"
                            aria-label="Pattern versions"
                            initial={
                              reduce
                                ? { opacity: 0 }
                                : { opacity: 0, y: -6, scale: 0.98 }
                            }
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={
                              reduce
                                ? { opacity: 0 }
                                : { opacity: 0, y: -6, scale: 0.98 }
                            }
                            transition={{
                              duration: reduce ? 0 : 0.16,
                              ease: [0.2, 0.8, 0.2, 1],
                            }}
                            className="border-strong bg-surface rounded-card absolute top-11 right-0 z-50 w-80 max-w-[calc(100vw-2rem)] origin-top-right space-y-3 border p-4 shadow-xl"
                          >
                            <label
                              className="block text-xs font-semibold"
                              htmlFor="arranger-version"
                            >
                              Exact pattern version
                              <select
                                id="arranger-version"
                                className={`${input} mt-1 w-full`}
                                value={selectedVersionId}
                                onChange={(event) =>
                                  setSelectedVersionId(event.target.value)
                                }
                              >
                                {midiVersions.map((version) => (
                                  <option
                                    key={version.stemVersionId}
                                    value={version.stemVersionId}
                                  >
                                    {version.name} · v{version.version} ·{" "}
                                    {version.creatorCreditName}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              className={`${button} w-full gap-2`}
                              type="button"
                              onClick={() => {
                                void importVersion();
                                setImportMenuOpen(false);
                              }}
                              disabled={
                                !selectedVersionId || status === "saving"
                              }
                            >
                              <FiFolderPlus /> Import exact version
                            </button>
                            <Link
                              className={`${button} w-full gap-2`}
                              href="#arrangement"
                            >
                              <FiMusic /> Back to arrangement
                            </Link>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              }
              statusRegion={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {editable && (
                    <button
                      className={button}
                      type="button"
                      disabled={status !== "dirty"}
                      onClick={() => void persist()}
                    >
                      {status === "saving" ? "Saving…" : "Save arrangement"}
                    </button>
                  )}
                  {props.mode === "workspace" && (
                    <button
                      className="cta-gradient min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
                      type="button"
                      disabled={
                        status !== "saved" ||
                        manifest.tracks.length === 0 ||
                        composerTarget !== null
                      }
                      onClick={() => void publish()}
                    >
                      Publish immutable revision
                    </button>
                  )}
                  <span
                    className={
                      status === "conflict" || status === "error"
                        ? "text-danger text-xs"
                        : "text-muted text-xs"
                    }
                    role="status"
                  >
                    {message ??
                      (status === "saved"
                        ? composerTarget
                          ? `Arrangement saved · MIDI draft ${draftSaveStatus}`
                          : "All changes saved"
                        : status === "dirty"
                          ? "Unsaved arrangement changes"
                          : status)}
                  </span>
                </div>
              }
            />
          </motion.div>
          <AnimatePresence>
            {composerTarget && editable && (
              <motion.div
                key="integrated-editor"
                className="absolute inset-0 z-20 flex flex-col"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                transition={{
                  duration: reduce ? 0 : 0.42,
                  ease: [0.2, 0.8, 0.2, 1],
                }}
                style={{ transformOrigin: editorOrigin }}
              >
                <IntegratedMidiComposer
                  key={`${composerTarget.operation}:${composerTarget.operation === "replace" ? composerTarget.clipId : composerTarget.trackId}`}
                  target={composerTarget}
                  ownerId={props.viewerId}
                  tempoBpm={manifest.tempoBpm}
                  timeSignature={manifest.timeSignature}
                  onClose={() => {
                    stopProjectTransport();
                    setComposerTarget(null);
                    setIntegratedDraftActive(false);
                    setDraftSaveStatus("saved");
                    finalizeIntentRef.current = null;
                    if (status === "saved")
                      acknowledgedGeneration.current = generation.current;
                    lifecycle.update({
                      status,
                      generation: generation.current,
                      acknowledgedGeneration: acknowledgedGeneration.current,
                      recoveryAvailable: status !== "saved",
                    });
                  }}
                  onTransportStart={startProjectTransport}
                  onTransportStop={stopProjectTransport}
                  onFinalize={finalizeIntegratedDraft}
                  onDraftStatusChange={setDraftSaveStatus}
                  onDraftOpened={() => setIntegratedDraftActive(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    );

  return (
    <section className="rounded-card border-strong bg-surface space-y-6 border p-5 sm:p-7">
      {recovery && editable && (
        <div role="alert" className="rounded-card border-accent border p-5">
          <h2 className="font-bold">
            Pending MIDI changes found on this device
          </h2>
          <p className="text-muted mt-1">
            Restore this local arrangement, or keep the server workspace.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="cta-gradient text-accent-contrast min-h-11 rounded-full px-4 font-semibold"
              onClick={() => {
                manifestRef.current = recovery.manifest;
                generation.current += 1;
                setManifest(recovery.manifest);
                setStatus(recovery.state === "conflict" ? "conflict" : "dirty");
                setRecovery(null);
                lifecycle.update({
                  status: recovery.state === "conflict" ? "conflict" : "dirty",
                  generation: generation.current,
                  acknowledgedGeneration: acknowledgedGeneration.current,
                  recoveryAvailable: true,
                });
              }}
            >
              Restore pending changes
            </button>
            <button
              type="button"
              className="border-strong min-h-11 rounded-full border px-4 font-semibold"
              onClick={() => {
                clearMidiLocalRecovery(editable.viewerId, editable.workspaceId);
                setRecovery(null);
              }}
            >
              Discard local copy
            </button>
          </div>
        </div>
      )}
      {props.mode === "contribution" && (
        <div className="border-subtle rounded-control border p-4">
          <p className="font-semibold">
            Contribution: {props.contributionTitle}
          </p>
          <p className="text-muted mt-1 text-sm">
            Replace exact pattern versions here, then return to the contribution
            to submit an immutable snapshot.
          </p>
          {composerTarget ? (
            <p className="text-muted mt-2 text-sm" role="status">
              Apply or close the MIDI draft before returning to submit.
            </p>
          ) : (
            <Link
              className="text-accent mt-2 inline-block underline"
              href={`/projects/${props.projectId}/contributions/${props.contributionId}`}
            >
              Return to contribution
            </Link>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-accent font-mono text-xs uppercase">MIDI Studio</p>
          <h2 className="mt-1 text-2xl font-semibold">Arrangement</h2>
          <p className="text-muted mt-1 text-sm">
            Pattern notes freeze into immutable versions. Arrange, mix, or
            explicitly replace one clip.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={button}
            type="button"
            onClick={() => void togglePlayback()}
            disabled={!manifest.tracks.length}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            className={button}
            type="button"
            disabled={!manifest.tracks.length}
            onClick={() =>
              download(
                exportStudioMidiV3(
                  toWorkspaceManifestV3(manifest, v3Authority),
                  stemVersions,
                  props.projectTitle,
                ),
                "mid",
              )
            }
          >
            Export .mid
          </button>
          <button
            className={button}
            type="button"
            disabled={!manifest.tracks.length || rendering}
            onClick={() =>
              void (async () => {
                setRendering(true);
                try {
                  download(
                    await renderStudioWavV3(
                      toWorkspaceManifestV3(manifest, v3Authority),
                      stemVersions,
                    ),
                    "wav",
                  );
                } catch (error) {
                  console.error("Local MIDI WAV render failed.", error);
                  setMessage(
                    "The local synth mix could not be rendered in this browser.",
                  );
                } finally {
                  setRendering(false);
                }
              })()
            }
          >
            {rendering ? "Rendering…" : "Export synth WAV"}
          </button>
        </div>
      </div>

      <label className="block text-sm font-semibold">
        Start playback at tick {seekTick}
        <input
          className="accent-accent mt-2 block w-full"
          type="range"
          min={0}
          max={manifest.durationTicks}
          step={MIDI_PPQ / 4}
          value={seekTick}
          onChange={(event) => setSeekTick(Number(event.target.value))}
        />
      </label>

      {editable && (
        <div className="rounded-control border-subtle bg-surface-soft flex flex-wrap items-end gap-3 border p-4">
          <label className="min-w-64 flex-1 text-sm font-semibold">
            Exact pattern version
            <select
              className={`${input} mt-2 w-full`}
              value={selectedVersionId}
              onChange={(event) => setSelectedVersionId(event.target.value)}
            >
              {midiVersions.map((version) => (
                <option
                  key={version.stemVersionId}
                  value={version.stemVersionId}
                >
                  {version.name} · v{version.version} ·{" "}
                  {version.creatorCreditName}
                </option>
              ))}
            </select>
          </label>
          <button
            className={button}
            type="button"
            onClick={() => void importVersion()}
            disabled={!selectedVersionId || status === "saving"}
          >
            Import exact version
          </button>
          <Link className={button} href="#arrangement">
            Back to arrangement
          </Link>
        </div>
      )}

      {manifest.tracks.length === 0 ? (
        <div className="border-strong rounded-control border border-dashed p-8 text-center">
          <h3 className="text-xl font-semibold">
            Bring in your first MIDI part.
          </h3>
          <p className="text-muted mt-2">
            Draw or record a pattern in the piano roll, or import a MIDI file.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {manifest.tracks.map((track) => {
            const clip = track.clips[0]!;
            const version = stemVersions.get(clip.midiStemVersionId);
            return (
              <li
                key={track.trackId}
                className="rounded-control border-subtle grid gap-4 border p-4 lg:grid-cols-[1fr_2fr]"
              >
                <div>
                  <p className="font-semibold">
                    {track.sortOrder + 1}. {track.name}
                  </p>
                  <p className="text-muted mt-1 text-sm">
                    {version?.creatorCreditName ?? "Unknown creator"} · exact
                    version {version?.version ?? "—"}
                  </p>
                  {editable && (
                    <select
                      aria-label={`Replace ${track.name} version`}
                      className={`${input} mt-3 w-full`}
                      value={clip.midiStemVersionId}
                      onChange={(event) =>
                        void replaceVersion(track.trackId, event.target.value)
                      }
                    >
                      {midiVersions.map((candidate) => (
                        <option
                          key={candidate.stemVersionId}
                          value={candidate.stemVersionId}
                        >
                          {candidate.name} · v{candidate.version}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs font-semibold">
                    Preset
                    <select
                      className={`${input} mt-1 w-full`}
                      disabled={!editable}
                      value={`${track.presetId}:${track.presetVersion}`}
                      onChange={(event) => {
                        const [presetId, presetVersion] =
                          event.target.value.split(":");
                        updateTrack(track.trackId, {
                          presetId,
                          presetVersion: Number(presetVersion),
                        });
                      }}
                    >
                      {INSTRUMENT_PRESETS_CATALOG_1.map((preset) => (
                        <option
                          key={`${preset.presetId}:${preset.version}`}
                          value={`${preset.presetId}:${preset.version}`}
                        >
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold">
                    Gain dB
                    <input
                      className={`${input} mt-1 w-full`}
                      type="number"
                      min={-60}
                      max={6}
                      step={0.5}
                      disabled={!editable}
                      value={track.gainDb}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          gainDb: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Pan
                    <input
                      className={`${input} mt-1 w-full`}
                      type="number"
                      min={-1}
                      max={1}
                      step={0.1}
                      disabled={!editable}
                      value={track.pan}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          pan: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Start tick
                    <input
                      className={`${input} mt-1 w-full`}
                      type="number"
                      min={0}
                      disabled={!editable}
                      value={clip.startTick}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          clips: [
                            { ...clip, startTick: Number(event.target.value) },
                          ],
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Length ticks
                    <input
                      className={`${input} mt-1 w-full`}
                      type="number"
                      min={1}
                      disabled={!editable}
                      value={clip.durationTicks}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          clips: [
                            {
                              ...clip,
                              durationTicks: Number(event.target.value),
                            },
                          ],
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={track.muted}
                      disabled={!editable}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          muted: event.target.checked,
                        })
                      }
                    />
                    Mute
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={track.soloed}
                      disabled={!editable}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          soloed: event.target.checked,
                        })
                      }
                    />
                    Solo
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={clip.loop}
                      disabled={!editable}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          clips: [{ ...clip, loop: event.target.checked }],
                        })
                      }
                    />
                    Loop
                  </label>
                  {editable && (
                    <button
                      className="text-danger text-left text-sm underline"
                      type="button"
                      onClick={() => removeTrack(track.trackId)}
                    >
                      Remove track
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={button}
            type="button"
            disabled={status !== "dirty"}
            onClick={() => void persist()}
          >
            {status === "saving" ? "Saving…" : "Save arrangement"}
          </button>
          {props.mode === "workspace" && (
            <button
              className="cta-gradient min-h-11 rounded-full px-5 text-sm font-semibold disabled:opacity-50"
              type="button"
              disabled={status !== "saved" || manifest.tracks.length === 0}
              onClick={() => void publish()}
            >
              Publish immutable revision
            </button>
          )}
          <span className="text-muted text-sm" role="status">
            {status === "saved"
              ? "All changes saved"
              : status === "dirty"
                ? "Unsaved arrangement changes"
                : status}
          </span>
        </div>
      )}
      {message && (
        <p
          className={
            status === "conflict" || status === "error"
              ? "text-danger"
              : "text-muted"
          }
          role="status"
        >
          {message}
        </p>
      )}
    </section>
  );
}
