import {
  createPresetVoice,
  resumeMidiAudioContext,
  type PresetVoice,
} from "@/features/midi/browser-engine/preset-voice.client";
import type { MidiEngineEvent } from "@/features/midi/scheduler";
import {
  AudioClockTransport,
  type RuntimeTransportSnapshot,
} from "./audio-clock-transport";

export class BrowserMidiRuntime {
  private voices = new Map<string, PresetVoice>();
  private midiCancellations = new Set<() => void>();
  private events: readonly MidiEngineEvent[] = [];
  private eventSignature = "";
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

  async play(fromSeconds = 0) {
    this.assertAvailable();
    await resumeMidiAudioContext();
    this.pause();
    const Tone = await import("tone");
    const context = Tone.getContext().rawContext;
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
  }

  pause() {
    this.transportClock.pause();
    for (const cancel of this.midiCancellations) cancel();
    this.midiCancellations.clear();
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
}

export function getMidiScheduleIdentity(events: readonly MidiEngineEvent[]) {
  return JSON.stringify(events, (key, value: unknown) =>
    key === "gainDb" || key === "pan" ? undefined : value,
  );
}
