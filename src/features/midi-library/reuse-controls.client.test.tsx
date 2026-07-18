import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MidiLibraryReuseControls } from "./reuse-controls.client";
import {
  reuseMidiLibraryPatternAction,
  saveMidiLibraryPatternAction,
} from "./reuse-actions";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock("./reuse-actions", () => ({
  saveMidiLibraryPatternAction: vi.fn(),
  removeSavedMidiLibraryPatternAction: vi.fn(),
  reuseMidiLibraryPatternAction: vi.fn(),
  getMidiLibraryExportAction: vi.fn(),
}));

const props = {
  listingId: "10000000-0000-4000-8000-000000000001",
  patternVersionId: "10000000-0000-4000-8000-000000000002",
  title: "Gold pulse",
  saved: false,
  canReuse: true,
  workspaces: [
    {
      projectId: "10000000-0000-4000-8000-000000000003",
      projectTitle: "Private sketch",
      workspaceId: "10000000-0000-4000-8000-000000000004",
      lockVersion: 7,
      updatedAt: "2026-07-18T12:00:00.000Z",
    },
  ],
};

describe("library reuse controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveMidiLibraryPatternAction).mockResolvedValue({
      ok: true,
      message: "Saved to your private clips.",
    });
    vi.mocked(reuseMidiLibraryPatternAction).mockResolvedValue({
      ok: true,
      message: "Imported.",
    });
  });
  afterEach(cleanup);

  it("saves the exact listing/version bookmark", async () => {
    render(<MidiLibraryReuseControls {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Save clip" }));
    await waitFor(() =>
      expect(saveMidiLibraryPatternAction).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: props.listingId,
          patternVersionId: props.patternVersionId,
        }),
      ),
    );
    expect(
      await screen.findByText("Saved to your private clips."),
    ).toBeVisible();
  });

  it("passes the selected workspace's exact optimistic lock to import", async () => {
    render(<MidiLibraryReuseControls {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Import exact version" }),
    );
    await waitFor(() =>
      expect(reuseMidiLibraryPatternAction).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "import",
          workspaceId: props.workspaces[0].workspaceId,
          expectedWorkspaceLockVersion: 7,
        }),
      ),
    );
  });

  it("replaces actions with retained-reference messaging when reuse authority is unavailable", () => {
    render(<MidiLibraryReuseControls {...props} canReuse={false} />);
    expect(screen.getByText(/saved reference remains/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Import exact version" }),
    ).not.toBeInTheDocument();
  });
});
