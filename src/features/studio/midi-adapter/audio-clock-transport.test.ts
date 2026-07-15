import { describe, expect, it } from "vitest";
import { AudioClockTransport } from "./audio-clock-transport";

describe("AudioClockTransport", () => {
  it("derives playback from the audio clock and preserves the exact pause offset", () => {
    const source = { currentTime: 10 };
    const transport = new AudioClockTransport();

    transport.start(source, 2.5, 10.02);
    expect(transport.snapshot()).toEqual({
      state: "playing",
      positionSeconds: 2.5,
    });

    source.currentTime = 11.27;
    expect(transport.snapshot().positionSeconds).toBeCloseTo(3.75);
    expect(transport.pause()).toEqual({
      state: "paused",
      positionSeconds: 3.75,
    });

    source.currentTime = 20;
    expect(transport.snapshot()).toEqual({
      state: "paused",
      positionSeconds: 3.75,
    });
  });
});
