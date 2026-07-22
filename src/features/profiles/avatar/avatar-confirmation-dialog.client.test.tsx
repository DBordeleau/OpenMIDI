import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvatarConfirmationDialog } from "./avatar-confirmation-dialog.client";

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    useReducedMotion: () => true,
    motion: {
      div: ({
        animate: _animate,
        initial: _initial,
        transition: _transition,
        ...props
      }: ComponentProps<"div"> & {
        animate?: unknown;
        initial?: unknown;
        transition?: unknown;
      }) => {
        void _animate;
        void _initial;
        void _transition;
        return React.createElement("div", props);
      },
    },
  };
});

afterEach(cleanup);

describe("AvatarConfirmationDialog", () => {
  it("labels the destructive choice and remains still for reduced motion", () => {
    const onCancel = vi.fn();
    render(
      <AvatarConfirmationDialog
        title="Discard your changes?"
        body="Your unsaved avatar choices will be lost."
        confirmLabel="Discard changes"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole("alertdialog", {
      name: "Discard your changes?",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(
      screen.getByRole("button", { name: "Discard changes" }),
    ).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
