import {
  createPresetVoice,
  resumeMidiAudioContext,
  type PresetVoice,
} from "@/features/midi/browser-engine/preset-voice.client";
import type { MidiEngineEvent } from "@/features/midi/scheduler";
import type { WorkspaceManifestV2 } from "@/features/studio/manifest/v2";
import { summarizeAudioBuffer } from "@/features/studio/arranger/audio-peaks.client";
import {
  AudioClockTransport,
  type RuntimeTransportSnapshot,
} from "./audio-clock-transport";

type AuthorizedAudioSource = { assetId: string; signedUrl: string };

type ActiveAudioSource = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: StereoPannerNode;
  trackId: string;
};

export class BrowserMidiRuntime {
  private voices = new Map<string, PresetVoice>();
  private audioBuffers = new Map<string, AudioBuffer>();
  private audioSources = new Set<ActiveAudioSource>();
  private midiCancellations = new Set<() => void>();
  private manifest: WorkspaceManifestV2 | null = null;
  private events: readonly MidiEngineEvent[] = [];
  private eventSignature = "";
  private audioContext: BaseAudioContext | null = null;
  private transportClock = new AudioClockTransport();
  private disposed = false;

  async prepare(events: readonly MidiEngineEvent[]) {
    this.assertAvailable();
    const signature = getMidiScheduleIdentity(events);
    if (signature !== this.eventSignature) this.pause();
    this.events = events;
    this.eventSignature = signature;
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
      this.voices.get(key)?.setMixer({ gainDb, pan });
    }
    for (const [key, voice] of this.voices) {
      if (presets.has(key)) continue;
      voice.dispose();
      this.voices.delete(key);
    }
  }

  async prepareAudio(
    manifest: WorkspaceManifestV2,
    sources: readonly AuthorizedAudioSource[],
    signal?: AbortSignal,
  ) {
    this.assertAvailable();
    this.manifest = manifest;
    this.updateAudioMixer(manifest);
    if (sources.length === 0) {
      this.audioBuffers.clear();
      return new Map<string, readonly number[]>();
    }
    const Tone = await import("tone");
    const context = Tone.getContext().rawContext;
    this.audioContext = context;
    const desiredAssetIds = new Set(sources.map((source) => source.assetId));
    for (const assetId of this.audioBuffers.keys())
      if (!desiredAssetIds.has(assetId)) this.audioBuffers.delete(assetId);
    const attempts = await Promise.allSettled(
      sources
        .filter((source) => !this.audioBuffers.has(source.assetId))
        .map(async (source) => {
          const response = await fetch(source.signedUrl, { signal });
          if (!response.ok) throw new Error("Audio source unavailable");
          const bytes = await response.arrayBuffer();
          return [
            source.assetId,
            await context.decodeAudioData(bytes),
          ] as const;
        }),
    );
    const decoded = attempts.flatMap((attempt) =>
      attempt.status === "fulfilled" ? [attempt.value] : [],
    );
    for (const [assetId, buffer] of decoded)
      this.audioBuffers.set(assetId, buffer);
    return new Map(
      [...this.audioBuffers].map(([assetId, buffer]) => [
        assetId,
        summarizeAudioBuffer(buffer),
      ]),
    );
  }

  updateManifest(manifest: WorkspaceManifestV2) {
    this.assertAvailable();
    this.manifest = manifest;
    this.updateAudioMixer(manifest);
  }

  async play(fromSeconds = 0) {
    this.assertAvailable();
    await resumeMidiAudioContext();
    this.pause();
    const Tone = await import("tone");
    const context = Tone.getContext().rawContext;
    this.audioContext = context;
    const transport = Tone.getTransport();
    if (transport.state !== "started") transport.start();
    const schedulingLeadSeconds = 0.02;
    const startTime = context.currentTime + schedulingLeadSeconds;
    this.transportClock.start(context, fromSeconds, startTime);
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
    this.transportClock.pause();
    for (const cancel of this.midiCancellations) cancel();
    this.midiCancellations.clear();
    for (const active of this.audioSources) {
      try {
        active.source.stop();
      } catch {
        // The source may already have ended.
      }
      active.source.disconnect();
      active.gain.disconnect();
      active.panner.disconnect();
    }
    this.audioSources.clear();
    this.allNotesOff();
  }

  allNotesOff() {
    for (const voice of this.voices.values()) voice.allNotesOff();
  }

  getTransportSnapshot(): RuntimeTransportSnapshot {
    return this.transportClock.snapshot();
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
    return `${event.trackId}:${event.presetId}:${event.presetVersion}`;
  }

  private updateAudioMixer(manifest: WorkspaceManifestV2) {
    const tracks = new Map(
      manifest.tracks.map((track) => [track.trackId, track]),
    );
    const hasSolo = manifest.tracks.some(
      (track) => track.soloed && !track.muted,
    );
    const now = this.audioContext?.currentTime ?? 0;
    for (const active of this.audioSources) {
      const track = tracks.get(active.trackId);
      if (!track) continue;
      const audible = !track.muted && (!hasSolo || track.soloed);
      const gain = audible ? 10 ** (track.gainDb / 20) : 0;
      active.gain.gain.cancelScheduledValues(now);
      active.gain.gain.setTargetAtTime(gain, now, 0.015);
      active.panner.pan.cancelScheduledValues(now);
      active.panner.pan.setTargetAtTime(track.pan, now, 0.015);
    }
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
        const active = { source, gain, panner, trackId: track.trackId };
        source.addEventListener(
          "ended",
          () => {
            this.audioSources.delete(active);
            source.disconnect();
            gain.disconnect();
            panner.disconnect();
          },
          { once: true },
        );
        this.audioSources.add(active);
        source.start(
          startTime + Math.max(0, clipStart - fromSeconds),
          offset,
          duration,
        );
      }
    }
  }
}

export function getMidiScheduleIdentity(events: readonly MidiEngineEvent[]) {
  return JSON.stringify(events, (key, value: unknown) =>
    key === "gainDb" || key === "pan" ? undefined : value,
  );
}
