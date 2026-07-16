import {
  createPresetVoice,
  resumeMidiAudioContext,
  type PresetVoice,
} from "@/features/midi/browser-engine/preset-voice.client";
import type { PublicMidiEvent } from "./schedule";

export class PublicMidiPreviewRuntime {
  private voices = new Map<string, PresetVoice>();
  private cancellations = new Set<() => void>();
  private events: readonly PublicMidiEvent[] = [];
  private disposed = false;

  async prepare(events: readonly PublicMidiEvent[]) {
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
      if (!this.voices.has(key)) {
        this.voices.set(
          key,
          await createPresetVoice(presetId, version, { gainDb, pan }),
        );
      }
    }
  }

  async play(fromSeconds: number) {
    this.assertAvailable();
    await resumeMidiAudioContext();
    this.pause();
    const Tone = await import("tone");
    const transport = Tone.getTransport();
    if (transport.state !== "started") transport.start();
    const transportStart = transport.seconds + 0.02;
    for (const event of this.events) {
      const endSeconds = event.startSeconds + event.durationSeconds;
      if (endSeconds <= fromSeconds) continue;
      const delay = Math.max(0, event.startSeconds - fromSeconds);
      const duration = endSeconds - Math.max(fromSeconds, event.startSeconds);
      const voice = this.voices.get(this.voiceKey(event));
      let cancel = () => {};
      const eventId = transport.scheduleOnce((time) => {
        this.cancellations.delete(cancel);
        voice?.triggerAttackRelease(
          event.pitch,
          duration,
          time,
          event.velocity / 127,
        );
      }, transportStart + delay);
      cancel = () => transport.clear(eventId);
      this.cancellations.add(cancel);
    }
  }

  pause() {
    for (const cancel of this.cancellations) cancel();
    this.cancellations.clear();
    for (const voice of this.voices.values()) voice.allNotesOff();
  }

  dispose() {
    if (this.disposed) return;
    this.pause();
    for (const voice of this.voices.values()) voice.dispose();
    this.voices.clear();
    this.disposed = true;
  }

  private voiceKey(event: PublicMidiEvent) {
    return `${event.trackId}:${event.presetId}:${event.presetVersion}`;
  }

  private assertAvailable() {
    if (this.disposed) throw new Error("MIDI preview runtime is disposed");
  }
}
