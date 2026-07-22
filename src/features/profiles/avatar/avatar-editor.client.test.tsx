import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avatarOptionsV1Schema, DEFAULT_AVATAR_OPTIONS } from "./contract";
import { AvatarEditor } from "./avatar-editor.client";

const reducedMotion = vi.hoisted(() => vi.fn(() => false));

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    useReducedMotion: reducedMotion,
    motion: {
      div: ({
        animate: _animate,
        transition: _transition,
        ...props
      }: ComponentProps<"div"> & {
        animate?: unknown;
        transition?: unknown;
      }) => {
        void _animate;
        void _transition;
        return React.createElement("div", props);
      },
    },
  };
});

function Harness() {
  const [options, setOptions] = useState(DEFAULT_AVATAR_OPTIONS);
  return (
    <>
      <AvatarEditor
        profileId="30000000-0000-4000-8000-000000000001"
        name="Ada"
        options={options}
        onChange={setOptions}
        actions={<button type="button">Save</button>}
      />
      <output data-testid="current-options">{JSON.stringify(options)}</output>
    </>
  );
}

describe("AvatarEditor", () => {
  beforeEach(() => reducedMotion.mockReturnValue(false));
  afterEach(cleanup);

  it("renders every catalog as accessible radio choices", () => {
    render(<Harness />);

    expect(screen.getAllByRole("radio", { name: /^Eyebrows / })).toHaveLength(
      15,
    );
    expect(screen.getAllByRole("radio", { name: /^Eyes / })).toHaveLength(26);
    expect(
      screen.getAllByRole("radio", { name: /^(Glasses |No glasses)/ }),
    ).toHaveLength(6);
    expect(screen.getAllByRole("radio", { name: /^Mouth / })).toHaveLength(30);
    expect(
      screen.getAllByRole("radio", { name: /#[0-9a-f]{6}$/ }),
    ).toHaveLength(7);
    expect(screen.getByRole("radio", { name: "Eyebrows 1" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "No glasses" })).toBeChecked();
  });

  it("updates each control family, preserves glasses variant for None, and normalizes custom color", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("radio", { name: "Eyebrows 2" }));
    fireEvent.click(screen.getByRole("radio", { name: "Eyes 3" }));
    fireEvent.click(screen.getByRole("radio", { name: "Glasses 4" }));
    expect(screen.getByRole("radio", { name: "Glasses 4" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "No glasses" }));
    fireEvent.click(screen.getByRole("radio", { name: "Mouth 5" }));
    fireEvent.change(screen.getByLabelText("Custom tone color"), {
      target: { value: "#ABCDEF" },
    });
    fireEvent.change(screen.getByLabelText("Avatar scale"), {
      target: { value: "1.35" },
    });
    fireEvent.change(screen.getByLabelText("Avatar rotation"), {
      target: { value: "-7" },
    });

    const currentOptions = JSON.parse(
      screen.getByTestId("current-options").textContent ?? "null",
    );
    expect(avatarOptionsV1Schema.parse(currentOptions)).toMatchObject({
      eyebrowsVariant: "variant02",
      eyesVariant: "variant03",
      glassesVariant: "variant04",
      glassesProbability: 0,
      mouthVariant: "variant05",
      backgroundColor: "abcdef",
      scale: 1.35,
      rotate: -7,
    });
  });

  it("randomizes to a valid draft and exposes reduced-motion state", () => {
    reducedMotion.mockReturnValue(true);
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Randomize" }));
    const preview = screen
      .getByText("Live preview")
      .parentElement?.querySelector("[data-avatar-fingerprint]");
    expect(preview).toHaveAttribute("data-reduced-motion", "true");
    expect(
      avatarOptionsV1Schema.safeParse(
        JSON.parse(screen.getByTestId("current-options").textContent ?? "null"),
      ).success,
    ).toBe(true);
  });
});
