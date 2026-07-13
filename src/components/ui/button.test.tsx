import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, ButtonLink } from "./button";

describe("shared buttons", () => {
  it("uses the adopted pill silhouette for buttons and links", () => {
    render(
      <>
        <Button>Save</Button>
        <ButtonLink href="/explore">Explore</ButtonLink>
      </>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "rounded-full",
    );
    expect(screen.getByRole("link", { name: "Explore" })).toHaveClass(
      "rounded-full",
    );
  });
});
