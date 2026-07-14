import { afterEach, describe, expect, it } from "vitest";
import { MIDI_PPQ } from "@/features/studio/manifest/v2";
import {
  clearMidiDraftRecovery,
  readMidiDraftRecovery,
  writeMidiDraftRecovery,
} from "./draft-recovery.client";

const ownerId = "10000000-0000-4000-8000-000000000001";
const draftId = "10000000-0000-4000-8000-000000000002";

afterEach(() => localStorage.clear());

describe("private MIDI draft recovery", () => {
  it("round trips validated pending content and clears it", () => {
    writeMidiDraftRecovery({
      version: 1,
      ownerId,
      draftId,
      serverLockVersion: 1,
      savedAt: new Date().toISOString(),
      state: "pending",
      content: {
        name: "Recovery phrase",
        defaultPresetId: "warm-poly",
        defaultPresetVersion: 1,
        ppq: MIDI_PPQ,
        durationTicks: 7_680,
        notes: [],
      },
    });
    expect(readMidiDraftRecovery(ownerId, draftId)?.content.name).toBe(
      "Recovery phrase",
    );
    clearMidiDraftRecovery(ownerId, draftId);
    expect(readMidiDraftRecovery(ownerId, draftId)).toBeNull();
  });

  it("ignores malformed or cross-schema browser data", () => {
    localStorage.setItem(
      `jam-session:midi-draft-recovery:v1:${ownerId}:${draftId}`,
      JSON.stringify({
        version: 1,
        ownerId,
        draftId,
        content: { notes: "bad" },
      }),
    );
    expect(readMidiDraftRecovery(ownerId, draftId)).toBeNull();
  });
});
