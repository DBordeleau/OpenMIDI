import { Midi } from "@tonejs/midi";
import { createPresetVoice } from "./browser-engine/preset-voice.client";
import { projectMidiSchedule } from "./scheduler";
import {
  MIDI_PPQ,
  type MidiStemVersionV1,
  type WorkspaceManifestV2,
} from "@/features/studio/manifest/v2";

export function exportMidiProject(
  manifest: WorkspaceManifestV2,
  stemVersions: ReadonlyMap<string, MidiStemVersionV1>,
  projectTitle: string,
) {
  const midi = new Midi();
  midi.header.fromJSON({
    name: projectTitle,
    ppq: MIDI_PPQ,
    tempos: [{ bpm: manifest.tempoBpm, ticks: 0 }],
    timeSignatures: [
      {
        ticks: 0,
        timeSignature: [
          manifest.timeSignature.numerator,
          manifest.timeSignature.denominator,
        ],
      },
    ],
    keySignatures: [],
    meta: [],
  });
  const exportManifest = {
    ...manifest,
    tracks: manifest.tracks.map((track) => ({
      ...track,
      muted: false,
      soloed: false,
    })),
  } as WorkspaceManifestV2;
  const events = projectMidiSchedule({
    manifest: exportManifest,
    stemVersions,
  });
  for (const projectTrack of exportManifest.tracks.filter(
    (track) => track.kind === "midi",
  )) {
    const track = midi.addTrack();
    track.name = projectTrack.name;
    for (const event of events.filter(
      ({ trackId }) => trackId === projectTrack.trackId,
    )) {
      track.addNote({
        midi: event.pitch,
        velocity: event.velocity / 127,
        ticks: event.startTick,
        durationTicks: event.endTick - event.startTick,
      });
    }
    track.endOfTrackTicks = manifest.durationTicks;
  }
  return midi.toArray();
}

export async function renderMidiProjectWav(
  manifest: WorkspaceManifestV2,
  stemVersions: ReadonlyMap<string, MidiStemVersionV1>,
  presetEngineVersion: string = manifest.engineVersion,
) {
  const Tone = await import("tone");
  const events = projectMidiSchedule({ manifest, stemVersions });
  const durationSeconds =
    (manifest.durationTicks * 60) / (manifest.tempoBpm * MIDI_PPQ);
  const sampleRate = 44_100;
  const disposableVoices: Awaited<ReturnType<typeof createPresetVoice>>[] = [];
  let rendered: Awaited<ReturnType<typeof Tone.Offline>>;
  try {
    rendered = await Tone.Offline(
      async () => {
        const voices = new Map<
          string,
          Awaited<ReturnType<typeof createPresetVoice>>
        >();
        for (const event of events) {
          const key = `${event.trackId}:${event.presetId}:${event.presetVersion}:${event.gainDb}:${event.pan}`;
          let voice = voices.get(key);
          if (!voice) {
            voice = await createPresetVoice(
              event.presetId,
              event.presetVersion,
              {
                gainDb: event.gainDb,
                pan: event.pan,
              },
              presetEngineVersion,
            );
            voices.set(key, voice);
            disposableVoices.push(voice);
          }
          voice.triggerAttackRelease(
            event.pitch,
            event.durationSeconds,
            event.startSeconds,
            event.velocity / 127,
          );
        }
      },
      durationSeconds + 1,
      2,
      sampleRate,
    );
  } finally {
    disposableVoices.forEach((voice) => voice.dispose());
  }
  const channels = [rendered.getChannelData(0), rendered.getChannelData(1)];
  return encodePcm16Wav(channels, sampleRate);
}

export function encodePcm16Wav(
  channels: readonly Float32Array[],
  sampleRate: number,
) {
  if (channels.length === 0 || channels.length > 2) {
    throw new RangeError("WAV rendering requires one or two channels");
  }
  if (
    !Number.isInteger(sampleRate) ||
    sampleRate < 8_000 ||
    sampleRate > 192_000
  ) {
    throw new RangeError("Invalid WAV sample rate");
  }
  const frames = channels[0]?.length ?? 0;
  if (!channels.every((channel) => channel.length === frames)) {
    throw new RangeError("WAV channels must have equal frame counts");
  }
  const buffer = new ArrayBuffer(44 + frames * channels.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((character, index) =>
      view.setUint8(offset + index, character.charCodeAt(0)),
    );
  text(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * channels.length * 2, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}
