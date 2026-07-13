import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";

describe("ErrorPage", () => {
  it("offers recovery without exposing error details", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("sensitive detail")} reset={reset} />);
    expect(screen.queryByText("sensitive detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
