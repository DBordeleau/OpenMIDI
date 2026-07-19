import { describe, expect, it } from "vitest";
import { parseWorkspaceManifestV2 } from "../manifest/v2";
import {
  ARRANGEMENT_HISTORY_LIMIT,
  commitArrangementHistory,
  createArrangementHistory,
  redoArrangement,
  undoArrangement,
} from "./history";

const manifest = parseWorkspaceManifestV2({
  manifestVersion: 2,
  engine: "openmidi-composite",
  engineVersion: "openmidi-composite-2_tone-15.1.22",
  projectId: "00000000-0000-4000-8000-000000000001",
  tempoBpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  durationTicks: 1_920,
  tracks: [],
});

describe("arrangement history", () => {
  it("groups one semantic gesture and supports bounded undo/redo", () => {
    let history = createArrangementHistory(manifest);
    history = commitArrangementHistory(
      history,
      { ...manifest, tempoBpm: 121 },
      "tempo",
    );
    history = commitArrangementHistory(
      history,
      { ...manifest, tempoBpm: 122 },
      "tempo",
    );
    expect(history.past).toHaveLength(1);
    expect(undoArrangement(history).present.tempoBpm).toBe(120);
    expect(redoArrangement(undoArrangement(history)).present.tempoBpm).toBe(
      122,
    );

    for (let index = 0; index < ARRANGEMENT_HISTORY_LIMIT + 5; index += 1)
      history = commitArrangementHistory(
        history,
        { ...history.present, tempoBpm: 123 + index },
        null,
      );
    expect(history.past).toHaveLength(ARRANGEMENT_HISTORY_LIMIT);
  });

  it("clears redo after a new semantic command", () => {
    let history = commitArrangementHistory(createArrangementHistory(manifest), {
      ...manifest,
      tempoBpm: 121,
    });
    history = undoArrangement(history);
    history = commitArrangementHistory(history, { ...manifest, tempoBpm: 130 });
    expect(history.future).toEqual([]);
  });
});
