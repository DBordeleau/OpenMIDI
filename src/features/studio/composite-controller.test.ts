import { describe, expect, it, vi } from "vitest";
import { CompositeDisposal } from "./composite-controller";

describe("composite runtime disposal contract", () => {
  it("silences MIDI and disposes both graphs exactly once", async () => {
    const midi = {
      allNotesOff: vi.fn(),
      dispose: vi.fn(async () => undefined),
    };
    const audio = { dispose: vi.fn(async () => undefined) };
    const disposal = new CompositeDisposal(midi, audio);
    await Promise.all([
      disposal.dispose(),
      disposal.dispose(),
      disposal.dispose(),
    ]);
    expect(midi.allNotesOff).toHaveBeenCalledOnce();
    expect(midi.dispose).toHaveBeenCalledOnce();
    expect(audio.dispose).toHaveBeenCalledOnce();
  });
});
