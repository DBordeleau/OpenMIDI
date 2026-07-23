import { describe, expect, it } from "vitest";
import {
  arrangementTotalTicks,
  countClips,
  decodePatternSilhouette,
  SILHOUETTE_COLUMNS,
  ticksPerBar,
  type ArrangementMapTrack,
} from "./arrangement-map";

function encode(bytes: number[]) {
  return Buffer.from(Uint8Array.from(bytes)).toString("base64");
}

function track(clips: Array<[number, number]>): ArrangementMapTrack {
  return {
    id: "t",
    name: "Track",
    sortOrder: 0,
    presetName: "Warm EP",
    family: "keys",
    clips: clips.map(([startTick, durationTicks], index) => ({
      clipId: `c${index}`,
      midiPatternVersionId: `p${index}`,
      startTick,
      durationTicks,
      loop: false,
    })),
  };
}

describe("decodePatternSilhouette", () => {
  it("decodes the canonical 64-column encoding", () => {
    const bytes = Array.from({ length: SILHOUETTE_COLUMNS }, (_, i) => i % 256);
    const columns = decodePatternSilhouette(encode(bytes));
    expect(columns).not.toBeNull();
    expect(columns).toHaveLength(SILHOUETTE_COLUMNS);
    expect(columns![0]).toBe(0);
    expect(columns![9]).toBe(9);
  });

  it("keeps the low band in bit 0", () => {
    const bytes = new Array(SILHOUETTE_COLUMNS).fill(0);
    bytes[3] = 0b1000_0001;
    const columns = decodePatternSilhouette(encode(bytes))!;
    expect(columns[3] & 1).toBe(1);
    expect(columns[3] & (1 << 7)).toBe(1 << 7);
  });

  // A clip with no silhouette renders as flat colour, so bad input must not throw.
  it.each([
    ["not base64 at all", "%%%%"],
    ["noncanonical padding", `${"A".repeat(88)}`],
    ["embedded whitespace", `${"A".repeat(43)}\n${"A".repeat(43)}==`],
    ["too few columns", encode([1, 2, 3])],
    ["too many columns", encode(new Array(80).fill(1))],
    ["empty", ""],
  ])("returns null for %s", (_label, encoded) => {
    expect(decodePatternSilhouette(encoded)).toBeNull();
  });
});

describe("arrangement geometry", () => {
  it("measures the arrangement by where its last clip stops", () => {
    expect(
      arrangementTotalTicks([track([[0, 1920]]), track([[3840, 960]])]),
    ).toBe(4800);
  });

  it("returns zero ticks for an arrangement with no clips", () => {
    expect(arrangementTotalTicks([track([])])).toBe(0);
  });

  it("derives bar length from the time signature", () => {
    expect(ticksPerBar({ numerator: 4, denominator: 4 })).toBe(1920);
    expect(ticksPerBar({ numerator: 7, denominator: 8 })).toBe(1680);
    expect(ticksPerBar(null)).toBe(1920);
  });

  it("counts clips across tracks", () => {
    expect(
      countClips([
        track([
          [0, 480],
          [480, 480],
        ]),
        track([[0, 960]]),
      ]),
    ).toBe(3);
  });
});
