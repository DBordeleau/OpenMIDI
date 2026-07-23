import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioRevisionSwitcher } from "./studio-revision-switcher.client";
import { useStudioNavigation } from "./studio-shell.client";

vi.mock("./studio-shell.client", () => ({
  useStudioNavigation: vi.fn(),
}));

const projectId = "10000000-0000-4000-8000-000000000123";
const revisionId = "20000000-0000-4000-8000-000000000123";

describe("StudioRevisionSwitcher", () => {
  afterEach(cleanup);

  it("switches a stale draft to the latest immutable revision", () => {
    const requestNavigation = vi.fn();
    vi.mocked(useStudioNavigation).mockReturnValue({
      requestNavigation,
      switching: false,
    });
    render(
      <StudioRevisionSwitcher
        projectId={projectId}
        revisionId={revisionId}
        revisionNumber={2}
        selected="draft"
        staleDraft
      />,
    );

    expect(screen.getByLabelText("Studio project source")).toHaveAttribute(
      "title",
      expect.stringContaining("latest revision 2"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Revision 2" }));
    expect(requestNavigation).toHaveBeenCalledWith(
      `/studio/${projectId}?revision=${revisionId}`,
    );
  });

  it("returns from a read-only revision to the preserved editable draft", () => {
    const requestNavigation = vi.fn();
    vi.mocked(useStudioNavigation).mockReturnValue({
      requestNavigation,
      switching: false,
    });
    render(
      <StudioRevisionSwitcher
        projectId={projectId}
        revisionId={revisionId}
        revisionNumber={2}
        selected="revision"
        staleDraft
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editable draft" }));
    expect(requestNavigation).toHaveBeenCalledWith(`/studio/${projectId}`);
  });
});
