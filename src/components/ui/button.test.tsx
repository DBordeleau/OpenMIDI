import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, ButtonLink } from "./button";

vi.mock("next/link", () => ({
  default: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: unknown }) => (
    <a
      {...props}
      data-prefetch={prefetch === false ? "false" : "unspecified"}
    />
  ),
}));

afterEach(cleanup);

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

  it("forwards an explicit no-prefetch override without changing the default", () => {
    render(
      <>
        <ButtonLink href="/projects/new" prefetch={false}>
          New project
        </ButtonLink>
        <ButtonLink href="/explore">Explore</ButtonLink>
      </>,
    );

    expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute(
      "data-prefetch",
      "false",
    );
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute(
      "data-prefetch",
      "unspecified",
    );
  });
});
