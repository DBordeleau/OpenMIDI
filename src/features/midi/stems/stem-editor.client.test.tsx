import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MidiStemDraft } from "./types";
import { MidiStemEditor } from "./stem-editor.client";

const performanceMock = vi.hoisted(() => ({
  status: "idle" as const,
  countIn: true,
  setCountIn: vi.fn(),
  metronome: true,
  setMetronome: vi.fn(),
  octave: 4,
  setOctave: vi.fn(),
  defaultVelocity: 96,
  setDefaultVelocity: vi.fn(),
  playheadTick: 0,
  webMidiStatus: "ready" as const,
  hardwareInputCount: 0,
  activePitches: new Set([60]) as ReadonlySet<number>,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  requestWebMidi: vi.fn(),
  releaseActive: vi.fn(),
  noteOn: vi.fn(),
  noteOff: vi.fn(),
  previewOn: vi.fn(() => true),
  previewOff: vi.fn(),
  previewNote: vi.fn(),
  keyDown: vi.fn(() => false),
  keyUp: vi.fn(() => false),
}));

vi.mock("./use-midi-performance.client", () => ({
  useMidiPerformance: () => performanceMock,
}));

vi.mock("./actions", () => ({
  publishMidiStemVersionAction: vi.fn(),
  saveMidiStemDraftAction: vi.fn(),
}));

const draft: MidiStemDraft = {
  draftId: "00000000-0000-4000-8000-000000000001",
  stemId: "00000000-0000-4000-8000-000000000002",
  ownerId: "00000000-0000-4000-8000-000000000003",
  entryMode: "blank",
  parentStemVersionId: null,
  name: "Piano feel",
  defaultPresetId: "warm-poly",
  defaultPresetVersion: 1,
  ppq: 480,
  durationTicks: 1_920,
  notes: [],
  noteCount: 0,
  contentSha256: "a".repeat(64),
  lockVersion: 1,
  createdAt: "2026-07-15T12:00:00.000Z",
  updatedAt: "2026-07-15T12:00:00.000Z",
};

const phraseDraft: MidiStemDraft = {
  ...draft,
  notes: [
    {
      noteId: "10000000-0000-4000-8000-000000000001",
      pitch: 90,
      velocity: 96,
      startTick: 120,
      durationTicks: 120,
    },
    {
      noteId: "10000000-0000-4000-8000-000000000002",
      pitch: 88,
      velocity: 88,
      startTick: 360,
      durationTicks: 120,
    },
  ],
  noteCount: 2,
};

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(
    HTMLCanvasElement.prototype,
    "getBoundingClientRect",
  ).mockReturnValue({
    left: 0,
    top: 0,
    right: 900,
    bottom: 430,
    width: 900,
    height: 430,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  Object.defineProperties(HTMLCanvasElement.prototype, {
    setPointerCapture: { configurable: true, value: vi.fn() },
    hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
    releasePointerCapture: { configurable: true, value: vi.fn() },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  performanceMock.previewOn.mockClear();
  performanceMock.previewOff.mockClear();
  performanceMock.previewNote.mockClear();
  performanceMock.noteOn.mockClear();
  performanceMock.noteOff.mockClear();
});

describe("MIDI editor piano interaction", () => {
  it("exposes active performance keys with aria-pressed", () => {
    render(<MidiStemEditor draft={draft} />);

    expect(
      screen.getByRole("button", { name: "Play C4, MIDI note 60" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Play C♯4, MIDI note 61" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("previews crossed gutter pitches once and releases on pointer up", () => {
    render(<MidiStemEditor draft={draft} />);
    const roll = screen.getByTestId("midi-piano-roll");

    fireEvent.pointerDown(roll, {
      button: 0,
      pointerId: 7,
      clientX: 20,
      clientY: 10,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 7,
      clientX: 20,
      clientY: 32,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 7,
      clientX: 20,
      clientY: 32,
    });
    fireEvent.pointerUp(roll, { pointerId: 7, clientX: 20, clientY: 32 });

    expect(performanceMock.previewOn.mock.calls).toEqual([
      [96, 96, "piano-gutter:7"],
      [95, 96, "piano-gutter:7"],
    ]);
    expect(performanceMock.previewOff).toHaveBeenCalledOnce();
    expect(performanceMock.previewOff).toHaveBeenCalledWith("piano-gutter:7");
  });

  it("glissandos across performance keys and releases the last crossed pitch", () => {
    render(<MidiStemEditor draft={draft} />);
    const keyboard = screen.getByLabelText("On-screen piano");
    const c4 = screen.getByRole("button", {
      name: "Play C4, MIDI note 60",
    });
    const cSharp4 = screen.getByRole("button", {
      name: "Play C♯4, MIDI note 61",
    });
    fireEvent.pointerDown(c4, { button: 0, pointerId: 8 });
    fireEvent.pointerEnter(cSharp4, { pointerId: 8 });
    fireEvent.pointerEnter(cSharp4, { pointerId: 8 });
    fireEvent.pointerUp(keyboard, { pointerId: 8 });

    expect(performanceMock.noteOn.mock.calls).toEqual([
      [60, 96, expect.any(Number), "performance-key:8"],
      [61, 96, expect.any(Number), "performance-key:8"],
    ]);
    expect(performanceMock.noteOff).toHaveBeenCalledOnce();
    expect(performanceMock.noteOff).toHaveBeenCalledWith(
      61,
      expect.any(Number),
      "performance-key:8",
    );
  });

  it("marquee-selects in tick/pitch space, toggles with Shift, and clears with Escape", () => {
    render(<MidiStemEditor draft={phraseDraft} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    const roll = screen.getByTestId("midi-piano-roll");

    fireEvent.pointerDown(roll, {
      button: 0,
      pointerId: 11,
      clientX: 96,
      clientY: 115,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 11,
      clientX: 185,
      clientY: 205,
    });
    fireEvent.pointerUp(roll, { pointerId: 11, clientX: 185, clientY: 205 });
    expect(screen.getByText(/draft payload/)).toHaveTextContent("2 selected");

    fireEvent.pointerDown(roll, {
      button: 0,
      pointerId: 12,
      clientX: 96,
      clientY: 125,
      shiftKey: true,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 12,
      clientX: 132,
      clientY: 154,
      shiftKey: true,
    });
    fireEvent.pointerUp(roll, { pointerId: 12, clientX: 132, clientY: 154 });
    expect(screen.getByText(/draft payload/)).toHaveTextContent("1 selected");

    fireEvent.keyDown(roll, { key: "Escape" });
    expect(screen.getByText(/draft payload/)).toHaveTextContent("0 selected");
  });

  it("moves and copy-drags a marquee selection as one undoable edit each", () => {
    render(<MidiStemEditor draft={phraseDraft} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    const roll = screen.getByTestId("midi-piano-roll");
    const noteList = screen.getByLabelText("Notes in stem");

    fireEvent.pointerDown(roll, {
      button: 0,
      pointerId: 21,
      clientX: 96,
      clientY: 115,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 21,
      clientX: 185,
      clientY: 205,
    });
    fireEvent.pointerUp(roll, { pointerId: 21, clientX: 185, clientY: 205 });

    fireEvent.pointerDown(roll, {
      button: 0,
      pointerId: 22,
      clientX: 115,
      clientY: 140,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 22,
      clientX: 137,
      clientY: 162,
    });
    fireEvent.pointerUp(roll, { pointerId: 22, clientX: 137, clientY: 162 });
    expect(noteList).toHaveTextContent("F6 · tick 240");

    fireEvent.pointerDown(roll, {
      button: 0,
      pointerId: 23,
      clientX: 137,
      clientY: 160,
      ctrlKey: true,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 23,
      clientX: 159,
      clientY: 160,
      ctrlKey: true,
    });
    fireEvent.pointerUp(roll, { pointerId: 23, clientX: 159, clientY: 160 });
    expect(screen.getByText(/draft payload/)).toHaveTextContent(
      "4 of 2,048 notes",
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText(/draft payload/)).toHaveTextContent(
      "2 of 2,048 notes",
    );
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByText(/draft payload/)).toHaveTextContent(
      "4 of 2,048 notes",
    );
  });

  it("auditions the grabbed note instead of the first selected note", () => {
    render(<MidiStemEditor draft={phraseDraft} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    const roll = screen.getByTestId("midi-piano-roll");

    fireEvent.pointerDown(roll, {
      button: 0,
      pointerId: 24,
      clientX: 96,
      clientY: 115,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 24,
      clientX: 185,
      clientY: 205,
    });
    fireEvent.pointerUp(roll, { pointerId: 24, clientX: 185, clientY: 205 });

    fireEvent.pointerDown(roll, {
      button: 0,
      pointerId: 25,
      clientX: 158,
      clientY: 184,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 25,
      clientX: 180,
      clientY: 206,
    });
    fireEvent.pointerUp(roll, { pointerId: 25, clientX: 180, clientY: 206 });

    expect(performanceMock.previewNote).toHaveBeenCalledWith(87, 88);
    expect(performanceMock.previewNote).not.toHaveBeenCalledWith(89, 96);
  });

  it("cancels a pointer preview without committing history", () => {
    render(<MidiStemEditor draft={phraseDraft} />);
    const roll = screen.getByTestId("midi-piano-roll");
    fireEvent.pointerDown(roll, {
      button: 0,
      pointerId: 31,
      clientX: 115,
      clientY: 140,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 31,
      clientX: 137,
      clientY: 162,
    });
    fireEvent.pointerCancel(roll, { pointerId: 31 });

    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByLabelText("Notes in stem")).toHaveTextContent(
      "F♯6 · tick 120",
    );
  });

  it("bypasses the selected grid with Alt while retaining integer ticks", () => {
    render(<MidiStemEditor draft={phraseDraft} />);
    const roll = screen.getByTestId("midi-piano-roll");
    fireEvent.pointerDown(roll, {
      button: 0,
      pointerId: 41,
      clientX: 115,
      clientY: 140,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 41,
      clientX: 116,
      clientY: 140,
      altKey: true,
    });
    fireEvent.pointerUp(roll, { pointerId: 41, clientX: 116, clientY: 140 });

    expect(screen.getByLabelText("Notes in stem")).toHaveTextContent(
      "F♯6 · tick 125",
    );
  });

  it("maps keyboard copy and paste to one semantic history step", () => {
    render(<MidiStemEditor draft={phraseDraft} />);
    const roll = screen.getByTestId("midi-piano-roll");

    fireEvent.keyDown(roll, { key: "c", ctrlKey: true });
    fireEvent.keyDown(roll, { key: "v", ctrlKey: true });
    expect(screen.getByText(/draft payload/)).toHaveTextContent(
      "3 of 2,048 notes",
    );
    expect(screen.getByText(/draft payload/)).toHaveTextContent("1 selected");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText(/draft payload/)).toHaveTextContent(
      "2 of 2,048 notes",
    );
  });
});
