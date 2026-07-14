import { describe, expect, it } from "vitest";
import {
  parseWaveformPeaks,
  serializeWaveformPeaks,
  sha256Hex,
  WAVEFORM_PEAKS_BIN_COUNT,
} from "./contract";

const sourceAssetId = "71000000-0000-4000-8000-000000000001";

function payload() {
  const values = new Float32Array(WAVEFORM_PEAKS_BIN_COUNT * 2);
  for (let index = 0; index < values.length; index += 2) {
    values[index] = -0.5;
    values[index + 1] = 0.75;
  }
  return serializeWaveformPeaks({
    sourceAssetId,
    channels: 1,
    durationMs: 2_000,
    sampleRateHz: 44_100,
    binCount: WAVEFORM_PEAKS_BIN_COUNT,
    values,
  });
}

describe("persisted waveform peak contract", () => {
  it("round-trips a compact source-bound summary", async () => {
    const bytes = payload();
    const parsed = parseWaveformPeaks(bytes);
    expect(bytes.byteLength).toBe(8_232);
    expect(parsed).toMatchObject({
      sourceAssetId,
      channels: 1,
      durationMs: 2_000,
      sampleRateHz: 44_100,
      binCount: WAVEFORM_PEAKS_BIN_COUNT,
    });
    expect(parsed.values[0]).toBe(-16_383);
    expect(parsed.values[1]).toBe(24_575);
    expect(await sha256Hex(bytes)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects stale versions, wrong lengths, sources, and numeric bounds", () => {
    const stale = payload();
    stale[4] = 2;
    expect(() => parseWaveformPeaks(stale)).toThrow(/version/);
    expect(() => parseWaveformPeaks(payload().subarray(0, 100))).toThrow(
      /length/,
    );
    expect(() =>
      serializeWaveformPeaks({
        sourceAssetId: "not-a-uuid",
        channels: 1,
        durationMs: 2_000,
        sampleRateHz: 44_100,
        binCount: WAVEFORM_PEAKS_BIN_COUNT,
        values: new Float32Array(WAVEFORM_PEAKS_BIN_COUNT * 2),
      }),
    ).toThrow(/source ID/);
    const invalid = new Float32Array(WAVEFORM_PEAKS_BIN_COUNT * 2);
    invalid[0] = 0.5;
    invalid[1] = -0.5;
    expect(() =>
      serializeWaveformPeaks({
        sourceAssetId,
        channels: 1,
        durationMs: 2_000,
        sampleRateHz: 44_100,
        binCount: WAVEFORM_PEAKS_BIN_COUNT,
        values: invalid,
      }),
    ).toThrow(/bounds/);
  });
});
