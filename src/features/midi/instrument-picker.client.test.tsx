import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InstrumentPicker } from "./instrument-picker.client";

describe("InstrumentPicker", () => {
  it("groups active catalog instruments and describes the exact selection", async () => {
    const onChange = vi.fn();
    render(<InstrumentPicker value="warm-keys" onChange={onChange} />);

    const picker = screen.getByRole("combobox", { name: "Instrument" });
    expect(screen.getAllByRole("group")).toHaveLength(6);
    expect(screen.getAllByRole("option")).toHaveLength(24);
    expect(screen.getByText(/Rounded polyphonic keys/)).toHaveTextContent(
      "up to 10 simultaneous voices",
    );

    await userEvent.selectOptions(picker, "sub-bass");
    expect(onChange).toHaveBeenCalledWith("sub-bass");
  });
});
