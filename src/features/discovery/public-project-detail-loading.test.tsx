import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicProjectDetailLoading } from "./public-project-detail-loading";

describe("public project detail loading", () => {
  it("announces detail loading without project-index copy", () => {
    const { container } = render(<PublicProjectDetailLoading />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading project details…",
    );
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy();
    expect(screen.queryByText("My projects")).not.toBeInTheDocument();
    expect(screen.queryByText("Your music workspace")).not.toBeInTheDocument();
  });
});
