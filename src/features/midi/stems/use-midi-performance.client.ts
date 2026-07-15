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

const RECORDING_BPM = 120;
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
  commitTake: (notes: readonly MidiNoteV1[]) => void;
  announce: (message: string) => void;
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
      const take = takeRef.current;
      takeRef.current = null;
      heldKeysRef.current.clear();
      setStatus("idle");
      if (take) {
        const notes = finishMidiRecording(take, performance.now());
        if (notes.length) inputRef.current.commitTake(notes);
      }
      if (reason && take) inputRef.current.announce(reason);
    },
    [clearTransport],
  );

  const noteOn = useCallback(
    (pitch: number, velocity: number, timestampMs: number) => {
      const current = inputRef.current;
      if (pitch < current.minPitch || pitch > current.maxPitch) {
        current.announce(
          "That note is outside the selected sound’s playable range.",
        );
        return;
      }
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
    },
    [],
  );

  const noteOff = useCallback((pitch: number, timestampMs: number) => {
    if (takeRef.current) {
      takeRef.current = recordMidiNoteOff(takeRef.current, {
        pitch,
        timestampMs,
      });
    }
  }, []);

  const startRecording = useCallback(async () => {
    stopRecording();
    const current = inputRef.current;
    const secondsPerBeat = 60 / RECORDING_BPM;
    const countInSeconds = countIn ? 4 * secondsPerBeat : 0;
    const startTimestampMs = performance.now() + countInSeconds * 1_000;
    takeRef.current = startMidiRecording({
      bpm: RECORDING_BPM,
      ppq: MIDI_PPQ,
      durationTicks: current.durationTicks,
      startTimestampMs,
    });
    setPlayheadTick(0);
    setStatus(countIn ? "count-in" : "recording");

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
        const countInBeats = countIn ? 4 : 0;
        for (let beat = 0; beat < countInBeats + totalBeats; beat += 1) {
          if (!metronome && beat >= countInBeats) break;
          voice.triggerAttackRelease(
            beat % 4 === 0 ? 84 : 79,
            0.04,
            audioNow + 0.05 + beat * secondsPerBeat,
            beat % 4 === 0 ? 0.75 : 0.45,
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
            noteOn(event.pitch, event.velocity, event.timestampMs);
          } else {
            noteOff(event.pitch, event.timestampMs);
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
      noteOn(pitch, defaultVelocity, performance.now());
      return true;
    },
    [defaultVelocity, noteOn, octave],
  );

  const keyUp = useCallback(
    (key: string) => {
      const pitch = heldKeysRef.current.get(key);
      if (pitch === undefined) return false;
      heldKeysRef.current.delete(key);
      noteOff(pitch, performance.now());
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
    },
    [clearTransport],
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
    startRecording,
    stopRecording,
    requestWebMidi,
    noteOn,
    noteOff,
    keyDown,
    keyUp,
  };
}
