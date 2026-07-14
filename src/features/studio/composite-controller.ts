import type { WorkspaceManifestV2 } from "./manifest/v2";
import type { MidiEngineEvent } from "@/features/midi/scheduler";

export type CompositeControllerStatus =
  | "idle"
  | "preparing"
  | "ready"
  | "playing"
  | "paused"
  | "disposing"
  | "disposed"
  | "error";

export interface LegacyAudioRuntimePort {
  prepare(manifest: WorkspaceManifestV2): Promise<void>;
  play(atTick: number): Promise<void>;
  pause(): void;
  seek(tick: number): void;
  setLoop(startTick: number, endTick: number): void;
  clearLoop(): void;
  dispose(): Promise<void>;
}

export interface MidiRuntimePort {
  prepare(events: readonly MidiEngineEvent[]): Promise<void>;
  play(atTick: number): Promise<void>;
  pause(): void;
  seek(tick: number): void;
  setLoop(startTick: number, endTick: number): void;
  clearLoop(): void;
  allNotesOff(): void;
  dispose(): Promise<void>;
}

export interface CompositeStudioController {
  readonly status: CompositeControllerStatus;
  prepare(manifest: WorkspaceManifestV2, signal: AbortSignal): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(tick: number): void;
  setLoop(startTick: number, endTick: number): void;
  clearLoop(): void;
  exportManifest(): WorkspaceManifestV2;
  /** Idempotent. Stops transport, silences MIDI, disconnects every node and listener. */
  dispose(): Promise<void>;
}

export class CompositeDisposal {
  private disposal: Promise<void> | null = null;

  constructor(
    private readonly midi: Pick<MidiRuntimePort, "allNotesOff" | "dispose">,
    private readonly audio: Pick<LegacyAudioRuntimePort, "dispose">,
  ) {}

  dispose(): Promise<void> {
    this.disposal ??= this.disposeOnce();
    return this.disposal;
  }

  private async disposeOnce() {
    this.midi.allNotesOff();
    await Promise.all([this.midi.dispose(), this.audio.dispose()]);
  }
}
