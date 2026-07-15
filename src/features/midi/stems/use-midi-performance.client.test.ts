import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { qwertyPitch, useMidiPerformance } from "./use-midi-performance.client";

let webMidiCallbacks:
  | {
      onNote(event: {
        type: "note-on" | "note-off";
        pitch: number;
        velocity: number;
        timestampMs: number;
      }): void;
      onDisconnect(): void;
    }
  | undefined;

vi.mock("../browser-engine/web-midi.client", () => ({
  requestWebMidiSession: vi.fn(
    async (callbacks: NonNullable<typeof webMidiCallbacks>) => {
      webMidiCallbacks = callbacks;
      return { inputCount: 1, dispose: vi.fn() };
    },
  ),
}));

function renderPerformance() {
  const audition = vi.fn();
  const releaseAudition = vi.fn();
  const announce = vi.fn();
  const hook = renderHook(() =>
    useMidiPerformance({
      durationTicks: 1_920,
      minPitch: 36,
      maxPitch: 96,
      existingNoteCount: 0,
      audition,
      releaseAudition,
      commitTake: vi.fn(),
      announce,
    }),
  );
  return { ...hook, audition, releaseAudition, announce };
}

afterEach(() => {
  vi.useRealTimers();
  webMidiCallbacks = undefined;
});

describe("QWERTY piano mapping", () => {
  it("maps A through K chromatically from the selected octave", () => {
    expect(qwertyPitch("a", 4)).toBe(60);
    expect(qwertyPitch("w", 4)).toBe(61);
    expect(qwertyPitch("k", 4)).toBe(72);
    expect(qwertyPitch("z", 4)).toBeNull();
  });
});

describe("MIDI performance active pitches", () => {
  it("keeps the union active until every source holding a pitch releases", () => {
    const { result, audition, releaseAudition } = renderPerformance();

    act(() => {
      result.current.noteOn(60, 90, 1, "pointer:1");
      result.current.noteOn(60, 100, 2, "hardware:60");
    });
    expect([...result.current.activePitches]).toEqual([60]);
    expect(audition).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.noteOff(60, 3, "pointer:1");
    });
    expect([...result.current.activePitches]).toEqual([60]);
    expect(releaseAudition).not.toHaveBeenCalled();

    act(() => {
      result.current.noteOff(60, 4, "hardware:60");
    });
    expect(result.current.activePitches.size).toBe(0);
    expect(releaseAudition).toHaveBeenCalledWith(60);
  });

  it("switches a pointer preview exactly once and times out bounded previews", () => {
    vi.useFakeTimers();
    const { result, audition } = renderPerformance();

    act(() => {
      expect(result.current.previewOn(60, 96, "gutter:1")).toBe(true);
      expect(result.current.previewOn(60, 96, "gutter:1")).toBe(false);
      expect(result.current.previewOn(62, 96, "gutter:1")).toBe(true);
    });
    expect([...result.current.activePitches]).toEqual([62]);
    expect(audition.mock.calls.map(([pitch]) => pitch)).toEqual([60, 62]);

    act(() => result.current.previewOff("gutter:1"));
    expect(result.current.activePitches.size).toBe(0);

    act(() => result.current.previewNote(64, 80, 120));
    expect([...result.current.activePitches]).toEqual([64]);
    act(() => vi.advanceTimersByTime(120));
    expect(result.current.activePitches.size).toBe(0);
  });

  it("tracks QWERTY and hardware MIDI and clears on disconnect", async () => {
    const { result, announce } = renderPerformance();

    act(() => {
      result.current.keyDown("a");
    });
    expect([...result.current.activePitches]).toEqual([60]);
    act(() => {
      result.current.keyUp("a");
    });
    expect(result.current.activePitches.size).toBe(0);

    await act(async () => result.current.requestWebMidi());
    act(() => {
      webMidiCallbacks?.onNote({
        type: "note-on",
        pitch: 67,
        velocity: 110,
        timestampMs: 10,
      });
    });
    expect([...result.current.activePitches]).toEqual([67]);

    act(() => webMidiCallbacks?.onDisconnect());
    expect(result.current.activePitches.size).toBe(0);
    expect(announce).toHaveBeenCalledWith(
      "Hardware MIDI disconnected. Manual piano and QWERTY input remain ready.",
    );
  });

  it("clears held input on stop, blur, and disposal", () => {
    const { result, unmount } = renderPerformance();

    act(() => result.current.noteOn(60, 96, 1, "pointer:1"));
    act(() => result.current.releaseActive());
    expect(result.current.activePitches.size).toBe(0);

    act(() => result.current.noteOn(62, 96, 2, "pointer:2"));
    act(() => window.dispatchEvent(new Event("blur")));
    expect(result.current.activePitches.size).toBe(0);

    act(() => result.current.noteOn(64, 96, 3, "pointer:3"));
    expect(() => unmount()).not.toThrow();
  });
});
