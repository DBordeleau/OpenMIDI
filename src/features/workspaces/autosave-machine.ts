export type AutosaveStatus =
  "saved" | "unsaved" | "saving" | "offline" | "error" | "conflict";

export type AutosaveState = { status: AutosaveStatus; message: string };
export const AUTOSAVE_DEBOUNCE_MS = 1_000;
export const AUTOSAVE_MAX_WAIT_MS = 5_000;

export function getAutosaveDelay(dirtySince: number, now: number) {
  return Math.max(
    0,
    Math.min(AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS - (now - dirtySince)),
  );
}
export type AutosaveEvent =
  | { type: "edit" }
  | { type: "save" }
  | { type: "saved" }
  | { type: "offline" }
  | { type: "error"; message: string }
  | { type: "conflict" }
  | { type: "retry" };

export const initialAutosaveState: AutosaveState = {
  status: "saved",
  message: "Saved",
};

export function reduceAutosave(
  state: AutosaveState,
  event: AutosaveEvent,
): AutosaveState {
  switch (event.type) {
    case "edit":
      return state.status === "conflict"
        ? state
        : { status: "unsaved", message: "Unsaved changes" };
    case "save":
    case "retry":
      return { status: "saving", message: "Saving draft…" };
    case "saved":
      return { status: "saved", message: "Saved" };
    case "offline":
      return {
        status: "offline",
        message: "Offline — changes are pending on this device",
      };
    case "error":
      return { status: "error", message: event.message };
    case "conflict":
      return {
        status: "conflict",
        message: "Another tab saved a newer draft",
      };
  }
}
