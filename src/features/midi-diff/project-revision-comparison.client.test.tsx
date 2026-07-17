import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { diffMidiArrangementsV1 } from "@/features/midi/semantic-diff-v1";
import {
  V3_DIFF_AFTER,
  V3_DIFF_BEFORE,
} from "@/features/studio/manifest/v3.fixtures";
import type { ProjectRevisionComparison } from "./project-revision-types";
import { ProjectRevisionComparisonView } from "./project-revision-comparison.client";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./paired-audition.client", () => ({
  MidiDiffPairedAudition: () => <div data-testid="paired-audition" />,
}));

const projectId = V3_DIFF_BEFORE.manifest.projectId;
const revision1 = "51000000-0000-4000-8000-000000000001";
const revision2 = "51000000-0000-4000-8000-000000000002";
const revision3 = "51000000-0000-4000-8000-000000000003";

afterEach(cleanup);

function comparison(input?: {
  from?: typeof V3_DIFF_BEFORE;
  to?: typeof V3_DIFF_AFTER;
  fromId?: string;
  toId?: string;
  onlyRevision?: boolean;
}): ProjectRevisionComparison {
  const before = input?.from ?? V3_DIFF_BEFORE;
  const after = input?.to ?? V3_DIFF_AFTER;
  const fromId = input?.fromId ?? revision1;
  const toId = input?.toId ?? revision3;
  return {
    project: { id: projectId, title: "Revision lab" },
    revisions: [
      {
        id: revision3,
        revisionNumber: 3,
        parentRevisionId: revision2,
        message: "Third pass",
        createdAt: "2026-07-03T00:00:00.000Z",
      },
      {
        id: revision2,
        revisionNumber: 2,
        parentRevisionId: revision1,
        message: "Second pass",
        createdAt: "2026-07-02T00:00:00.000Z",
      },
      {
        id: revision1,
        revisionNumber: 1,
        parentRevisionId: null,
        message: "First pass",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    before: {
      revisionId: fromId,
      revisionNumber: fromId === revision1 ? 1 : 2,
      arrangementVersionId: "52000000-0000-4000-8000-000000000001",
      ...before,
      attributions: [{ kind: "publisher", creditName: "Loop Maker" }],
    },
    after: {
      revisionId: toId,
      revisionNumber: toId === revision3 ? 3 : 2,
      arrangementVersionId: "52000000-0000-4000-8000-000000000003",
      ...after,
      attributions: [{ kind: "publisher", creditName: "Loop Maker" }],
    },
    semanticDiff: diffMidiArrangementsV1(before, after),
    onlyRevision: input?.onlyRevision ?? false,
  };
}

describe("ProjectRevisionComparisonView", () => {
  it("renders the shared diff and writes selector changes and swaps to canonical URLs", async () => {
    push.mockReset();
    const user = userEvent.setup();
    render(<ProjectRevisionComparisonView comparison={comparison()} />);

    expect(await screen.findByTestId("paired-audition")).toBeVisible();
    const counts = screen.getByRole("group", {
      name: "Filter comparison navigator by change type",
    });
    expect(
      within(counts).getByRole("button", { name: /Added3/ }),
    ).toBeVisible();
    expect(
      within(counts).getByRole("button", { name: /Changed8/ }),
    ).toBeVisible();
    expect(
      within(counts).getByRole("button", { name: /Removed3/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("list", { name: "Note comparison legend" }),
    ).toHaveTextContent(/\+Added/);

    await user.selectOptions(screen.getByLabelText("From revision"), revision2);
    expect(push).toHaveBeenLastCalledWith(
      `/projects/${projectId}/revisions/compare?from=${revision2}&to=${revision3}`,
    );

    await user.click(screen.getByRole("button", { name: "Swap sides" }));
    expect(push).toHaveBeenLastCalledWith(
      `/projects/${projectId}/revisions/compare?from=${revision3}&to=${revision1}`,
    );
  });

  it("renders explicit same-revision and one-revision states", async () => {
    const sameFixture = comparison({
      from: V3_DIFF_BEFORE,
      to: V3_DIFF_BEFORE,
      fromId: revision2,
      toId: revision2,
      onlyRevision: true,
    });
    sameFixture.revisions = [sameFixture.revisions[1]];
    render(<ProjectRevisionComparisonView comparison={sameFixture} />);

    expect(
      screen.getByRole("heading", { name: "One revision so far" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Same revision on both sides" }),
    ).toBeVisible();
  });
});
