"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MidiNoteV1 } from "@/features/studio/manifest/v2";
import {
  MAX_MIDI_NOTES_PER_STEM,
  MIDI_PPQ,
} from "@/features/studio/manifest/v2";
import { detectWebMidiCapability } from "../browser-capability";
import {
  finishMidiRecording,
  performanceTimestampToTick,
  recordMidiNoteOff,
  recordMidiNoteOn,
  startMidiRecording,
  type MidiRecordingTake,
} from "../recording";

const KEY_OFFSETS: Readonly<Record<string, number>> = Object.freeze({
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
});

export type MidiRecordStatus = "idle" | "count-in" | "recording";
export type WebMidiStatus =
  | "checking"
  | "unavailable"
  | "ready"
  | "requesting"
  | "connected"
  | "denied"
  | "disconnected";

export function qwertyPitch(key: string, octave: number) {
  const offset = KEY_OFFSETS[key.toLowerCase()];
  return offset === undefined ? null : (octave + 1) * 12 + offset;
}

export function useMidiPerformance(input: {
  durationTicks: number;
  minPitch: number;
  maxPitch: number;
  existingNoteCount: number;
  audition: (pitch: number, velocity: number) => void;
  releaseAudition: (pitch: number) => void;
  commitTake: (notes: readonly MidiNoteV1[]) => void;
  announce: (message: string) => void;
  bpm?: number;
  beatsPerBar?: number;
  onTransportStart?: (countInSeconds: number) => void;
  onTransportStop?: () => void;
}) {
  const [status, setStatus] = useState<MidiRecordStatus>("idle");
  const [countIn, setCountIn] = useState(true);
  const [metronome, setMetronome] = useState(true);
  const [octave, setOctave] = useState(4);
  const [defaultVelocity, setDefaultVelocity] = useState(96);
  const [playheadTick, setPlayheadTick] = useState(0);
  const [webMidiStatus, setWebMidiStatus] = useState<WebMidiStatus>(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return "checking";
    }
    const requestMidiAccess = (
      navigator as Navigator & { requestMIDIAccess?: unknown }
    ).requestMIDIAccess;
    return detectWebMidiCapability({
      secureContext: window.isSecureContext,
      requestMidiAccess,
    }).supported
      ? "ready"
      : "unavailable";
  });
  const [hardwareInputCount, setHardwareInputCount] = useState(0);
  const takeRef = useRef<MidiRecordingTake | null>(null);
  const heldKeysRef = useRef(new Map<string, number>());
  const activeSourcesRef = useRef(new Map<string, number>());
  const recordingPitchesRef = useRef(new Set<number>());
  const previewTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const previewSequenceRef = useRef(0);
  const [activePitches, setActivePitches] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playheadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const metronomeVoiceRef = useRef<{
    allNotesOff(): void;
    dispose(): void;
  } | null>(null);
  const webMidiSessionRef = useRef<{ dispose(): void } | null>(null);
  const audioWatcherRef = useRef<(() => void) | null>(null);
  const inputRef = useRef(input);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const syncActivePitches = useCallback(() => {
    setActivePitches(new Set(activeSourcesRef.current.values()));
  }, []);

  const closeRecordedPitch = useCallback(
    (pitch: number, timestampMs: number) => {
      if (takeRef.current) {
        takeRef.current = recordMidiNoteOff(takeRef.current, {
          pitch,
          timestampMs,
        });
      }
    },
    [],
  );

  const releaseSource = useCallback(
    (source: string, timestampMs: number, update = true) => {
      const pitch = activeSourcesRef.current.get(source);
      if (pitch === undefined) return false;
      activeSourcesRef.current.delete(source);
      const timer = previewTimersRef.current.get(source);
      if (timer) clearTimeout(timer);
      previewTimersRef.current.delete(source);
      const stillActive = [...activeSourcesRef.current.values()].includes(
        pitch,
      );
      if (!stillActive) {
        if (recordingPitchesRef.current.delete(pitch)) {
          closeRecordedPitch(pitch, timestampMs);
        }
        inputRef.current.releaseAudition(pitch);
      }
      if (update) syncActivePitches();
      return true;
    },
    [closeRecordedPitch, syncActivePitches],
  );

  const releaseAllActive = useCallback(
    (timestampMs: number, update = true) => {
      for (const source of [...activeSourcesRef.current.keys()]) {
        releaseSource(source, timestampMs, false);
      }
      previewTimersRef.current.forEach(clearTimeout);
      previewTimersRef.current.clear();
      if (update) syncActivePitches();
    },
    [releaseSource, syncActivePitches],
  );

  const clearTransport = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (playheadTimerRef.current) clearInterval(playheadTimerRef.current);
    playheadTimerRef.current = null;
    metronomeVoiceRef.current?.allNotesOff();
    metronomeVoiceRef.current?.dispose();
    metronomeVoiceRef.current = null;
    audioWatcherRef.current?.();
    audioWatcherRef.current = null;
  }, []);

  const stopRecording = useCallback(
    (reason?: string) => {
      clearTransport();
      releaseAllActive(performance.now());
      const take = takeRef.current;
      takeRef.current = null;
      heldKeysRef.current.clear();
      setStatus("idle");
      inputRef.current.onTransportStop?.();
      if (take) {
        const notes = finishMidiRecording(take, performance.now());
        if (notes.length) inputRef.current.commitTake(notes);
      }
      if (reason && take) inputRef.current.announce(reason);
    },
    [clearTransport, releaseAllActive],
  );

  const noteOn = useCallback(
    (
      pitch: number,
      velocity: number,
      timestampMs: number,
      source = `manual:${pitch}`,
    ) => {
      const current = inputRef.current;
      if (pitch < current.minPitch || pitch > current.maxPitch) {
        current.announce(
          "That note is outside the selected sound’s playable range.",
        );
        return;
      }
      const previous = activeSourcesRef.current.get(source);
      if (previous === pitch) return;
      if (previous !== undefined) releaseSource(source, timestampMs, false);
      const alreadyActive = [...activeSourcesRef.current.values()].includes(
        pitch,
      );
      activeSourcesRef.current.set(source, pitch);
      syncActivePitches();
      if (alreadyActive) return;
      current.audition(pitch, velocity);
      const take = takeRef.current;
      if (!take || timestampMs < take.startTimestampMs) return;
      if (
        current.existingNoteCount + take.notes.length + take.activeNotes.size >=
        MAX_MIDI_NOTES_PER_STEM
      ) {
        current.announce("This take reached the 2,048-note stem limit.");
        return;
      }
      takeRef.current = recordMidiNoteOn(take, {
        pitch,
        velocity,
        timestampMs,
        noteId: crypto.randomUUID(),
      });
      recordingPitchesRef.current.add(pitch);
    },
    [releaseSource, syncActivePitches],
  );

  const noteOff = useCallback(
    (pitch: number, timestampMs: number, source = `manual:${pitch}`) =>
      releaseSource(source, timestampMs),
    [releaseSource],
  );

  const previewOn = useCallback(
    (pitch: number, velocity: number, source: string) => {
      const current = inputRef.current;
      if (pitch < current.minPitch || pitch > current.maxPitch) return false;
      const previous = activeSourcesRef.current.get(source);
      if (previous === pitch) return false;
      if (previous !== undefined)
        releaseSource(source, performance.now(), false);
      const alreadyActive = [...activeSourcesRef.current.values()].includes(
        pitch,
      );
      activeSourcesRef.current.set(source, pitch);
      syncActivePitches();
      if (!alreadyActive) current.audition(pitch, velocity);
      return true;
    },
    [releaseSource, syncActivePitches],
  );

  const previewOff = useCallback(
    (source: string) => releaseSource(source, performance.now()),
    [releaseSource],
  );

  const previewNote = useCallback(
    (pitch: number, velocity = 96, durationMs = 180) => {
      const source = `preview:${++previewSequenceRef.current}`;
      if (!previewOn(pitch, velocity, source)) return;
      previewTimersRef.current.set(
        source,
        setTimeout(() => previewOff(source), durationMs),
      );
    },
    [previewOff, previewOn],
  );

  const startRecording = useCallback(async () => {
    stopRecording();
    const current = inputRef.current;
    const bpm = current.bpm ?? 120;
    const beatsPerBar = current.beatsPerBar ?? 4;
    const secondsPerBeat = 60 / bpm;
    const countInSeconds = countIn ? beatsPerBar * secondsPerBeat : 0;
    const startTimestampMs = performance.now() + countInSeconds * 1_000;
    takeRef.current = startMidiRecording({
      bpm,
      ppq: MIDI_PPQ,
      durationTicks: current.durationTicks,
      startTimestampMs,
    });
    setPlayheadTick(0);
    setStatus(countIn ? "count-in" : "recording");
    current.onTransportStart?.(countInSeconds);

    try {
      const {
        createPresetVoice,
        resumeMidiAudioContext,
        watchMidiAudioContextSuspension,
      } = await import("../browser-engine/preset-voice.client");
      const audioNow = await resumeMidiAudioContext();
      audioWatcherRef.current = watchMidiAudioContextSuspension(() =>
        stopRecording("Recording stopped because browser audio was suspended."),
      );
      if (countIn || metronome) {
        const voice = await createPresetVoice("warm-poly", 1);
        metronomeVoiceRef.current = voice;
        const totalBeats = Math.ceil(current.durationTicks / MIDI_PPQ);
        const countInBeats = countIn ? beatsPerBar : 0;
        for (let beat = 0; beat < countInBeats + totalBeats; beat += 1) {
          if (!metronome && beat >= countInBeats) break;
          voice.triggerAttackRelease(
            beat % beatsPerBar === 0 ? 84 : 79,
            0.04,
            audioNow + 0.05 + beat * secondsPerBeat,
            beat % beatsPerBar === 0 ? 0.75 : 0.45,
          );
        }
      }
    } catch {
      current.announce(
        "Recording is armed without an audible count-in. Check browser audio permission if you need the click.",
      );
    }

    if (countIn) {
      timersRef.current.push(
        setTimeout(() => setStatus("recording"), countInSeconds * 1_000),
      );
    }
    const recordingMs =
      (current.durationTicks / MIDI_PPQ) * secondsPerBeat * 1_000;
    timersRef.current.push(
      setTimeout(
        () => stopRecording("Take complete. Added as one undoable edit."),
        countInSeconds * 1_000 + recordingMs,
      ),
    );
    playheadTimerRef.current = setInterval(() => {
      const take = takeRef.current;
      if (!take) return;
      setPlayheadTick(
        Math.min(
          take.durationTicks,
          performanceTimestampToTick({
            ...take,
            timestampMs: performance.now(),
          }),
        ),
      );
    }, 50);
  }, [countIn, metronome, stopRecording]);

  const requestWebMidi = useCallback(async () => {
    setWebMidiStatus("requesting");
    try {
      const { requestWebMidiSession } =
        await import("../browser-engine/web-midi.client");
      webMidiSessionRef.current?.dispose();
      const session = await requestWebMidiSession({
        onNote(event) {
          if (event.type === "note-on") {
            noteOn(
              event.pitch,
              event.velocity,
              event.timestampMs,
              `hardware:${event.pitch}`,
            );
          } else {
            noteOff(event.pitch, event.timestampMs, `hardware:${event.pitch}`);
          }
        },
        onDisconnect() {
          setWebMidiStatus("disconnected");
          setHardwareInputCount(0);
          inputRef.current.announce(
            "Hardware MIDI disconnected. Manual piano and QWERTY input remain ready.",
          );
          stopRecording("Open hardware notes were closed safely.");
        },
      });
      webMidiSessionRef.current = session;
      setHardwareInputCount(session.inputCount);
      setWebMidiStatus("connected");
    } catch {
      setWebMidiStatus("denied");
    }
  }, [noteOff, noteOn, stopRecording]);

  const keyDown = useCallback(
    (key: string) => {
      if (heldKeysRef.current.has(key)) return true;
      const pitch = qwertyPitch(key, octave);
      if (pitch === null) return false;
      heldKeysRef.current.set(key, pitch);
      noteOn(pitch, defaultVelocity, performance.now(), `qwerty:${key}`);
      return true;
    },
    [defaultVelocity, noteOn, octave],
  );

  const keyUp = useCallback(
    (key: string) => {
      const pitch = heldKeysRef.current.get(key);
      if (pitch === undefined) return false;
      heldKeysRef.current.delete(key);
      noteOff(pitch, performance.now(), `qwerty:${key}`);
      return true;
    },
    [noteOff],
  );

  useEffect(() => {
    const release = () =>
      stopRecording("Recording stopped when the editor lost focus.");
    const visibility = () => {
      if (document.visibilityState === "hidden") release();
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [stopRecording]);

  useEffect(
    () => () => {
      clearTransport();
      webMidiSessionRef.current?.dispose();
      webMidiSessionRef.current = null;
      takeRef.current = null;
      heldKeysRef.current.clear();
      releaseAllActive(performance.now(), false);
    },
    [clearTransport, releaseAllActive],
  );

  return {
    status,
    countIn,
    setCountIn,
    metronome,
    setMetronome,
    octave,
    setOctave,
    defaultVelocity,
    setDefaultVelocity,
    playheadTick,
    webMidiStatus,
    hardwareInputCount,
    activePitches,
    startRecording,
    stopRecording,
    requestWebMidi,
    releaseActive: () => releaseAllActive(performance.now()),
    noteOn,
    noteOff,
    previewOn,
    previewOff,
    previewNote,
    keyDown,
    keyUp,
  };
}
