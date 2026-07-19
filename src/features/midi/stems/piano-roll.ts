const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export const PIANO_KEY_WIDTH = 88;
export const PITCH_ROW_HEIGHT = 22;
export const MIDDLE_C_PITCH = 60;

export type PianoRollPoint = {
  tick: number;
  pitch: number;
};

export type PianoRollSelectionRectangle = {
  startTick: number;
  endTick: number;
  minPitch: number;
  maxPitch: number;
};

export function pianoRollSelectionRectangle(
  start: PianoRollPoint,
  end: PianoRollPoint,
): PianoRollSelectionRectangle {
  return {
    startTick: Math.min(start.tick, end.tick),
    endTick: Math.max(start.tick, end.tick),
    minPitch: Math.min(start.pitch, end.pitch),
    maxPitch: Math.max(start.pitch, end.pitch),
  };
}

export function noteIntersectsPianoRollRectangle(
  note: {
    startTick: number;
    durationTicks: number;
    pitch: number;
  },
  rectangle: PianoRollSelectionRectangle,
) {
  return (
    note.startTick <= rectangle.endTick &&
    note.startTick + note.durationTicks >= rectangle.startTick &&
    note.pitch >= rectangle.minPitch &&
    note.pitch <= rectangle.maxPitch
  );
}

export function isBlackPianoKey(pitch: number) {
  return BLACK_PITCH_CLASSES.has(((pitch % 12) + 12) % 12);
}

export function midiPitchName(pitch: number) {
  const names = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

export function pianoKeyLabel(pitch: number) {
  // The roll gutter labels only the C octaves so the grid stays quiet; drum
  // names live on the performance keys and the kit map summary instead.
  return pitch % 12 === 0 ? midiPitchName(pitch) : null;
}

export function pianoKeyFace(pitch: number) {
  return isBlackPianoKey(pitch)
    ? {
        x: PIANO_KEY_WIDTH * 0.36,
        width: PIANO_KEY_WIDTH * 0.64,
        insetY: 1,
      }
    : { x: 0, width: PIANO_KEY_WIDTH, insetY: 0 };
}

export function initialPianoScrollTop(input: {
  minPitch: number;
  maxPitch: number;
  viewportHeight: number;
  targetPitch?: number;
}) {
  const targetPitch = Math.max(
    input.minPitch,
    Math.min(input.maxPitch, input.targetPitch ?? MIDDLE_C_PITCH),
  );
  const rowCenter =
    (input.maxPitch - targetPitch) * PITCH_ROW_HEIGHT + PITCH_ROW_HEIGHT / 2;
  const contentHeight =
    (input.maxPitch - input.minPitch + 1) * PITCH_ROW_HEIGHT;
  return Math.max(
    0,
    Math.min(
      contentHeight - input.viewportHeight,
      rowCenter - input.viewportHeight / 2,
    ),
  );
}
