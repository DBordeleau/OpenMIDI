import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  V3_DIFF_AFTER,
  V3_DIFF_BEFORE,
} from "@/features/studio/manifest/v3.fixtures";
import {
  MidiDiffPairedAudition,
  type MidiDiffAuditionRuntime,
} from "./paired-audition.client";

function fakeRuntime() {
  return {
    prepare: vi.fn().mockResolvedValue(undefined),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    dispose: vi.fn(),
  } satisfies MidiDiffAuditionRuntime;
}

describe("MidiDiffPairedAudition", () => {
  it("keeps playback mutually exclusive and disposes on selection change and unmount", async () => {
    const baseRuntime = fakeRuntime();
    const submittedRuntime = fakeRuntime();
    const thirdRuntime = fakeRuntime();
    const runtimes = [baseRuntime, submittedRuntime, thirdRuntime];
    const runtimeFactory = vi.fn(async () => runtimes.shift()!);
    const props = {
      before: V3_DIFF_BEFORE,
      after: V3_DIFF_AFTER,
      sideLabels: { before: "Base revision", after: "Submitted version" },
      runtimeFactory,
    };
    const view = render(
      <MidiDiffPairedAudition {...props} selectionKey="clip-a" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play Base revision" }));
    await screen.findByText(/Now playing Base revision/);
    expect(baseRuntime.prepare).toHaveBeenCalledOnce();
    expect(baseRuntime.play).toHaveBeenCalledWith(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Play Submitted version" }),
    );
    await screen.findByText(/Now playing Submitted version/);
    expect(baseRuntime.pause).toHaveBeenCalled();
    expect(baseRuntime.dispose).toHaveBeenCalledOnce();
    expect(submittedRuntime.play).toHaveBeenCalledWith(0);
    expect(
      screen.getByRole("button", { name: "Stop Submitted version" }),
    ).toHaveAttribute("aria-pressed", "true");

    view.rerender(<MidiDiffPairedAudition {...props} selectionKey="clip-b" />);
    await waitFor(() =>
      expect(submittedRuntime.dispose).toHaveBeenCalledOnce(),
    );
    expect(screen.getByText("No comparison side is playing.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Play Base revision" }));
    await screen.findByText(/Now playing Base revision/);
    view.unmount();
    expect(thirdRuntime.dispose).toHaveBeenCalledOnce();
  });
});
