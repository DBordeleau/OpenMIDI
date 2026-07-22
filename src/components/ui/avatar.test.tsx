import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR_OPTIONS } from "@/features/profiles/avatar/contract";
import { Avatar } from "./avatar";

const generatedConfig = {
  version: 1,
  seed: "30000000-0000-4000-8000-000000000001",
  options: DEFAULT_AVATAR_OPTIONS,
};

describe("Avatar compatibility boundary", () => {
  it("prefers a valid generated avatar", async () => {
    render(
      <Avatar
        src="https://example.test/legacy.webp"
        avatarConfig={generatedConfig}
        name="Ada"
      />,
    );
    const image = await screen.findByRole("img", { name: "Ada's avatar" });
    expect(image).toHaveAttribute(
      "src",
      expect.stringMatching(/^data:image\/svg\+xml/),
    );
  });

  it("retains uploaded URL and initial fallbacks during AVATAR-01", () => {
    const { rerender } = render(
      <Avatar src="https://example.test/legacy.webp" name="Bea" />,
    );
    expect(screen.getByRole("img", { name: "Bea's avatar" })).toHaveAttribute(
      "src",
      "https://example.test/legacy.webp",
    );

    rerender(<Avatar src={null} avatarConfig={{ version: 2 }} name="Cara" />);
    expect(screen.getByLabelText("Cara's initials")).toHaveTextContent("C");
  });
});
