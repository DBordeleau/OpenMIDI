"use client";

import { useEffect, useRef, useState } from "react";
import type { PresetVoice } from "./browser-engine/preset-voice.client";
import type { PresetBenchmark } from "./browser-engine/preset-voice.client";
import { detectWebMidiCapability } from "./browser-capability";
import {
  MIDI_EIGHT_TRACK_FIXTURE,
  MIDI_MAX_SCHEDULE_FIXTURE,
  MIDI_PIANO_ROLL_2000_NOTES,
  MIDI_SINGLE_TRACK_FIXTURE,
} from "./fixtures";
import { SYNTH_PRESETS_V1 } from "./presets";
import { projectMidiSchedule } from "./scheduler";
import { applyMidiStemCommand } from "./semantic-commands";
import type { MidiCommandState } from "./semantic-commands";

type Benchmark = { name: string; events: number; elapsedMs: number };

export function MidiFeasibilityHarness() {
  const [notes, setNotes] = useState(MIDI_PIANO_ROLL_2000_NOTES);
  const [selectedId, setSelectedId] = useState(notes[0].noteId);
  const [presetId, setPresetId] = useState("warm-poly");
  const [audioStatus, setAudioStatus] = useState("Audio spike not run");
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [presetBenchmarks, setPresetBenchmarks] = useState<PresetBenchmark[]>(
    [],
  );
  const [hardwareMidi, setHardwareMidi] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voiceRef = useRef<PresetVoice | null>(null);
  const selected =
    notes.find(({ noteId }) => noteId === selectedId) ?? notes[0];

  useEffect(() => {
    const capabilityTimer = window.setTimeout(() => {
      setHardwareMidi(
        detectWebMidiCapability({
          secureContext: window.isSecureContext,
          requestMidiAccess:
            "requestMIDIAccess" in navigator
              ? navigator.requestMIDIAccess
              : undefined,
        }).supported,
      );
      const fixtures = [
        ["1 track", MIDI_SINGLE_TRACK_FIXTURE],
        ["8 tracks / 2,000 notes", MIDI_EIGHT_TRACK_FIXTURE],
        ["16 tracks / 16,384 notes", MIDI_MAX_SCHEDULE_FIXTURE],
      ] as const;
      setBenchmarks(
        fixtures.map(([name, fixture]) => {
          const start = performance.now();
          const events = projectMidiSchedule(fixture);
          return {
            name,
            events: events.length,
            elapsedMs: performance.now() - start,
          };
        }),
      );
    }, 0);
    return () => window.clearTimeout(capabilityTimer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const scale = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#232624";
    context.fillRect(0, 0, width, height);
    for (const note of notes) {
      const x = ((note.startTick % 7_200) / 7_200) * width;
      const y = ((84 - note.pitch) / 37) * height;
      context.fillStyle = note.noteId === selectedId ? "#f7b955" : "#70a88b";
      context.fillRect(x, y, Math.max(2, note.durationTicks / 24), 3);
    }
  }, [notes, selectedId]);

  useEffect(() => () => voiceRef.current?.dispose(), []);

  function updateSelected(patch: {
    pitch?: number;
    velocity?: number;
    startTick?: number;
  }) {
    if (!selected) return;
    let state: MidiCommandState = { durationTicks: 120_120, notes };
    if (patch.pitch !== undefined || patch.startTick !== undefined) {
      state = applyMidiStemCommand(state, {
        type: "moveNotes",
        noteIds: [selected.noteId],
        deltaTicks:
          (patch.startTick ?? selected.startTick) - selected.startTick,
        deltaPitch: (patch.pitch ?? selected.pitch) - selected.pitch,
      });
    }
    if (patch.velocity !== undefined) {
      state = applyMidiStemCommand(state, {
        type: "setVelocity",
        noteIds: [selected.noteId],
        velocity: patch.velocity,
      });
    }
    setNotes([...state.notes]);
  }

  async function runAudioSpike() {
    setAudioStatus("Building synth voice…");
    voiceRef.current?.dispose();
    const start = performance.now();
    const { createPresetVoice, resumeMidiAudioContext } =
      await import("./browser-engine/preset-voice.client");
    const resumedAt = performance.now();
    await resumeMidiAudioContext();
    const voice = await createPresetVoice(presetId, 1);
    voiceRef.current = voice;
    const readyAt = performance.now();
    const preset = SYNTH_PRESETS_V1.find((item) => item.presetId === presetId)!;
    const note = Math.max(preset.minNote, Math.min(preset.maxNote, 60));
    voice.triggerAttackRelease(note, 0.18, undefined, 0.75);
    setAudioStatus(
      `Ready in ${(readyAt - start).toFixed(1)} ms (module ${(resumedAt - start).toFixed(1)} ms); −3 dB limiter with −6 dB output safety.`,
    );
  }

  async function benchmarkPresets() {
    setAudioStatus("Rendering all preset voice caps offline…");
    const { benchmarkPresetVoice } =
      await import("./browser-engine/preset-voice.client");
    const results: PresetBenchmark[] = [];
    for (const preset of SYNTH_PRESETS_V1) {
      results.push(await benchmarkPresetVoice(preset.presetId, preset.version));
    }
    setPresetBenchmarks(results);
    setAudioStatus("All seven preset graphs rendered without samples.");
  }

  return (
    <div className="space-y-6" data-testid="midi-feasibility-harness">
      <section className="rounded-card border-strong bg-surface border p-5">
        <h2 className="text-xl font-semibold">Deterministic scheduler</h2>
        <ul className="text-muted mt-3 grid gap-2 md:grid-cols-3">
          {benchmarks.map((benchmark) => (
            <li className="rounded-control bg-canvas p-3" key={benchmark.name}>
              <strong className="text-foreground block">
                {benchmark.name}
              </strong>
              {benchmark.events.toLocaleString()} events ·{" "}
              {benchmark.elapsedMs.toFixed(2)} ms
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-card border-strong bg-surface border p-5">
        <h2 className="text-xl font-semibold">Piano-roll interaction spike</h2>
        <p className="text-muted mt-1">
          2,000 canonical notes; canvas is visual only and the inspector is the
          accessible authority.
        </p>
        <canvas
          aria-hidden="true"
          className="bg-canvas mt-4 h-64 w-full rounded-lg"
          ref={canvasRef}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <label className="grid gap-1">
            <span>Selected note</span>
            <select
              className="rounded-control border-strong bg-canvas min-h-11 border px-3"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {notes.slice(0, 32).map((note, index) => (
                <option key={note.noteId} value={note.noteId}>
                  Note {index + 1}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="Pitch"
            min={0}
            max={127}
            value={selected.pitch}
            onChange={(pitch) => updateSelected({ pitch })}
          />
          <NumberField
            label="Start tick"
            min={0}
            max={120_000}
            value={selected.startTick}
            onChange={(startTick) => updateSelected({ startTick })}
          />
          <NumberField
            label="Velocity"
            min={1}
            max={127}
            value={selected.velocity}
            onChange={(velocity) => updateSelected({ velocity })}
          />
        </div>
      </section>

      <section className="rounded-card border-strong bg-surface border p-5">
        <h2 className="text-xl font-semibold">Sample-free Tone.js presets</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid min-w-56 gap-1">
            <span>Preset</span>
            <select
              className="rounded-control border-strong bg-canvas min-h-11 border px-3"
              value={presetId}
              onChange={(event) => setPresetId(event.target.value)}
            >
              {SYNTH_PRESETS_V1.map((preset) => (
                <option key={preset.presetId} value={preset.presetId}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-control bg-accent min-h-11 px-5 font-semibold text-slate-950"
            onClick={runAudioSpike}
            type="button"
          >
            Audition preset
          </button>
          <button
            className="rounded-control border-strong min-h-11 border px-5 font-semibold"
            onClick={benchmarkPresets}
            type="button"
          >
            Benchmark all presets
          </button>
        </div>
        <p className="text-muted mt-3" role="status">
          {audioStatus}
        </p>
        <p className="text-muted mt-1">
          Hardware MIDI:{" "}
          {hardwareMidi
            ? "available, permission not requested"
            : "unavailable; manual editing remains complete"}
        </p>
        {presetBenchmarks.length > 0 ? (
          <ul className="text-muted mt-3 grid gap-2 sm:grid-cols-2">
            {presetBenchmarks.map((benchmark) => (
              <li
                className="rounded-control bg-canvas p-3"
                key={benchmark.presetId}
              >
                <strong className="text-foreground block">
                  {resolvePresetName(benchmark.presetId)}
                </strong>
                {benchmark.voices} voices · {benchmark.renderMs.toFixed(1)} ms ·
                peak {benchmark.peakDbfs.toFixed(1)} dBFS
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function resolvePresetName(presetId: string) {
  return (
    SYNTH_PRESETS_V1.find((preset) => preset.presetId === presetId)?.name ??
    presetId
  );
}

function NumberField({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1">
      <span>{label}</span>
      <input
        className="rounded-control border-strong bg-canvas min-h-11 border px-3"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}
