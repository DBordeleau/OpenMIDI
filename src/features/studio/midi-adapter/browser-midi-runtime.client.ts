import {
  createPresetVoice,
  resumeMidiAudioContext,
  type PresetVoice,
} from "@/features/midi/browser-engine/preset-voice.client";
import type { MidiEngineEvent } from "@/features/midi/scheduler";
import type { WorkspaceManifestV2 } from "@/features/studio/manifest/v2";
import { summarizeAudioBuffer } from "@/features/studio/arranger/audio-peaks.client";

type AuthorizedAudioSource = { assetId: string; signedUrl: string };

export class BrowserMidiRuntime {
  private voices = new Map<string, PresetVoice>();
  private audioBuffers = new Map<string, AudioBuffer>();
  private audioSources = new Set<AudioBufferSourceNode>();
  private midiCancellations = new Set<() => void>();
  private manifest: WorkspaceManifestV2 | null = null;
  private events: readonly MidiEngineEvent[] = [];
  private disposed = false;

  async prepare(events: readonly MidiEngineEvent[]) {
    this.assertAvailable();
    this.pause();
    this.events = events;
    const presets = new Map(
      events.map((event) => [
        this.voiceKey(event),
        [event.presetId, event.presetVersion, event.gainDb, event.pan] as const,
      ]),
    );
    for (const [key, [presetId, version, gainDb, pan]] of presets) {
      if (!this.voices.has(key))
        this.voices.set(
          key,
          await createPresetVoice(presetId, version, { gainDb, pan }),
        );
    }
  }

  async prepareAudio(
    manifest: WorkspaceManifestV2,
    sources: readonly AuthorizedAudioSource[],
    signal?: AbortSignal,
  ) {
    this.assertAvailable();
    this.manifest = manifest;
    if (sources.length === 0) {
      this.audioBuffers.clear();
      return new Map<string, readonly number[]>();
    }
    const Tone = await import("tone");
    const context = Tone.getContext().rawContext;
    const attempts = await Promise.allSettled(
      sources.map(async (source) => {
        const response = await fetch(source.signedUrl, { signal });
        if (!response.ok) throw new Error("Audio source unavailable");
        const bytes = await response.arrayBuffer();
        return [source.assetId, await context.decodeAudioData(bytes)] as const;
      }),
    );
    const decoded = attempts.flatMap((attempt) =>
      attempt.status === "fulfilled" ? [attempt.value] : [],
    );
    this.audioBuffers = new Map(decoded);
    return new Map(
      decoded.map(([assetId, buffer]) => [
        assetId,
        summarizeAudioBuffer(buffer),
      ]),
    );
  }

  async play(fromSeconds = 0) {
    this.assertAvailable();
    const resumedAt = await resumeMidiAudioContext();
    this.pause();
    const Tone = await import("tone");
    const transport = Tone.getTransport();
    if (transport.state !== "started") transport.start();
    const schedulingLeadSeconds = 0.02;
    const startTime = resumedAt + schedulingLeadSeconds;
    const transportStart = transport.seconds + schedulingLeadSeconds;
    for (const event of this.events) {
      const endSeconds = event.startSeconds + event.durationSeconds;
      if (endSeconds <= fromSeconds) continue;
      const delay = Math.max(0, event.startSeconds - fromSeconds);
      const duration = endSeconds - Math.max(fromSeconds, event.startSeconds);
      const voice = this.voices.get(this.voiceKey(event));
      let cancel = () => {};
      const eventId = transport.scheduleOnce((time) => {
        this.midiCancellations.delete(cancel);
        voice?.triggerAttackRelease(
          event.pitch,
          duration,
          time,
          event.velocity / 127,
        );
      }, transportStart + delay);
      cancel = () => transport.clear(eventId);
      this.midiCancellations.add(cancel);
    }
    await this.playAudio(fromSeconds, startTime);
  }

  pause() {
    for (const cancel of this.midiCancellations) cancel();
    this.midiCancellations.clear();
    for (const source of this.audioSources) {
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
      source.disconnect();
    }
    this.audioSources.clear();
    this.allNotesOff();
  }

  allNotesOff() {
    for (const voice of this.voices.values()) voice.allNotesOff();
  }

  dispose() {
    if (this.disposed) return;
    this.pause();
    for (const voice of this.voices.values()) voice.dispose();
    this.voices.clear();
    this.disposed = true;
  }

  private assertAvailable() {
    if (this.disposed) throw new Error("MIDI runtime is disposed");
  }

  private voiceKey(event: MidiEngineEvent) {
    return `${event.trackId}:${event.presetId}:${event.presetVersion}:${event.gainDb}:${event.pan}`;
  }

  private async playAudio(fromSeconds: number, startTime: number) {
    if (!this.manifest) return;
    const Tone = await import("tone");
    const context = Tone.getContext().rawContext;
    const audioTracks = this.manifest.tracks.filter(
      (track) => track.kind === "audio",
    );
    const hasSolo = this.manifest.tracks.some(
      (track) => track.soloed && !track.muted,
    );
    for (const track of audioTracks) {
      if (track.muted || (hasSolo && !track.soloed)) continue;
      const buffer = this.audioBuffers.get(track.assetId);
      if (!buffer) continue;
      for (const clip of track.clips) {
        const clipStart = clip.positionMs / 1_000;
        const clipEnd = clipStart + clip.durationMs / 1_000;
        if (clipEnd <= fromSeconds) continue;
        const audibleStart = Math.max(fromSeconds, clipStart);
        const offset = clip.trimStartMs / 1_000 + audibleStart - clipStart;
        const duration = clipEnd - audibleStart;
        const source = context.createBufferSource();
        const gain = context.createGain();
        const panner = context.createStereoPanner();
        source.buffer = buffer;
        gain.gain.value = 10 ** (track.gainDb / 20);
        panner.pan.value = track.pan;
        source.connect(gain).connect(panner).connect(context.destination);
        source.addEventListener(
          "ended",
          () => {
            this.audioSources.delete(source);
            source.disconnect();
            gain.disconnect();
            panner.disconnect();
          },
          { once: true },
        );
        this.audioSources.add(source);
        source.start(
          startTime + Math.max(0, clipStart - fromSeconds),
          offset,
          duration,
        );
      }
    }
  }
}
