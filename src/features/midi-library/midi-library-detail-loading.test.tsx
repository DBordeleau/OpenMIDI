import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MidiLibraryDetailLoading } from "./midi-library-detail-loading";

describe("MIDI library detail loading", () => {
  it("announces pattern detail loading without library-index copy", () => {
    const { container } = render(<MidiLibraryDetailLoading />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading MIDI pattern details…",
    );
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy();
    expect(screen.queryByText(/Find a pattern/)).not.toBeInTheDocument();
    expect(screen.queryByText("MIDI library")).not.toBeInTheDocument();
  });
});
