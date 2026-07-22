import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR_OPTIONS } from "@/features/profiles/avatar/contract";
import { Avatar } from "./avatar";

const generatedConfig = {
  version: 1,
  seed: "30000000-0000-4000-8000-000000000001",
  options: DEFAULT_AVATAR_OPTIONS,
};

describe("Avatar", () => {
  it("renders a valid generated avatar with descriptive accessibility", async () => {
    render(<Avatar avatarConfig={generatedConfig} name="Ada" />);
    const image = await screen.findByRole("img", { name: "Ada's avatar" });
    expect(image).toHaveAttribute(
      "src",
      expect.stringMatching(/^data:image\/svg\+xml/),
    );
  });

  it("uses initials for missing or invalid configuration", () => {
    const { rerender } = render(<Avatar avatarConfig={null} name="Bea" />);
    expect(screen.getByLabelText("Bea's initials")).toHaveTextContent("B");

    rerender(<Avatar avatarConfig={{ version: 2 }} name="Cara" />);
    expect(screen.getByLabelText("Cara's initials")).toHaveTextContent("C");
  });

  it("keeps decorative faces out of the accessible image tree", async () => {
    render(<Avatar avatarConfig={generatedConfig} name="Ada" decorative />);
    expect(await screen.findByRole("presentation")).toHaveAttribute("alt", "");
  });
});
