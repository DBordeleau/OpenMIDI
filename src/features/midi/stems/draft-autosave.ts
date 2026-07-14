export type MidiDraftSaveStatus =
  "saved" | "unsaved" | "saving" | "offline" | "error" | "conflict";

export type MidiDraftSaveState = {
  status: MidiDraftSaveStatus;
  message: string;
};

export const MIDI_DRAFT_AUTOSAVE_DEBOUNCE_MS = 1_000;
export const MIDI_DRAFT_AUTOSAVE_MAX_WAIT_MS = 5_000;

export function getMidiDraftAutosaveDelay(dirtySince: number, now: number) {
  return Math.max(
    0,
    Math.min(
      MIDI_DRAFT_AUTOSAVE_DEBOUNCE_MS,
      MIDI_DRAFT_AUTOSAVE_MAX_WAIT_MS - (now - dirtySince),
    ),
  );
}

export type MidiDraftSaveEvent =
  | { type: "edit" }
  | { type: "save" }
  | { type: "saved" }
  | { type: "offline" }
  | { type: "error" }
  | { type: "conflict" };

export const initialMidiDraftSaveState: MidiDraftSaveState = {
  status: "saved",
  message: "Draft loaded from your private library.",
};

export function reduceMidiDraftSave(
  state: MidiDraftSaveState,
  event: MidiDraftSaveEvent,
): MidiDraftSaveState {
  switch (event.type) {
    case "edit":
      return state.status === "conflict"
        ? state
        : { status: "unsaved", message: "Unsaved changes" };
    case "save":
      return { status: "saving", message: "Saving your private draft…" };
    case "saved":
      return { status: "saved", message: "Saved to My stems." };
    case "offline":
      return {
        status: "offline",
        message: "Offline — changes are waiting in this tab.",
      };
    case "error":
      return {
        status: "error",
        message: "Autosave paused. Your changes remain in this tab.",
      };
    case "conflict":
      return {
        status: "conflict",
        message: "Another tab saved this draft first. Reload to recover.",
      };
  }
}
