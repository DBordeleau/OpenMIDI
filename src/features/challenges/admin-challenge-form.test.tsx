import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AdminChallengeForm,
  type ChallengeFormDefaults,
} from "./admin-challenge-form.client";
import { canonicalizeChallengeConstraintsV1 } from "./constraint-v1";

const defaults: ChallengeFormDefaults = {
  slug: "four-track-sprint",
  title: "Four Track Sprint",
  prompt: "Say more with four parts.",
  description: "Build one focused arrangement with exactly four tracks.",
  eligibilityTerms: "Submit only work you are authorized to share.",
  presentationCode: "pulse",
  opensAt: "2026-08-01T12:00:00.000Z",
  submissionsCloseAt: "2026-08-08T12:00:00.000Z",
  votingOpensAt: "2026-08-09T12:00:00.000Z",
  votingClosesAt: "2026-08-10T12:00:00.000Z",
  resultsExpectedAt: "2026-08-11T12:00:00.000Z",
  judgingMode: "community",
  officialPlacementCount: 0,
  starterProjectId: null,
  starterRevisionId: null,
  constraints: canonicalizeChallengeConstraintsV1({
    schemaVersion: 1,
    trackCount: { minimum: null, maximum: null, exact: 4 },
  }),
  judges: [{ role: "host", displayName: "OpenMIDI", profileId: null }],
};

afterEach(cleanup);

describe("AdminChallengeForm", () => {
  it("shows the canonical readable rules and enables a valid draft", () => {
    render(
      <AdminChallengeForm mode="create" defaults={defaults} starters={[]} />,
    );
    expect(screen.getByText("Use 4 tracks.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create challenge draft" }),
    ).toBeEnabled();
  });

  it("disables saving when the constraint document has no configured rule", async () => {
    const user = userEvent.setup();
    render(
      <AdminChallengeForm mode="create" defaults={defaults} starters={[]} />,
    );
    await user.click(
      screen.getAllByRole("checkbox", { name: "Enable rule" })[0]!,
    );
    expect(
      screen.getByRole("button", { name: "Create challenge draft" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Add one complete machine-checkable rule/),
    ).toBeVisible();
  });

  it("uses one request id for an attempt and creates a fresh id after success", async () => {
    const requestIds: string[] = [];
    const action = vi.fn(async (_state, formData: FormData) => {
      requestIds.push(JSON.parse(String(formData.get("payload"))).requestId);
      return { status: "success" as const, message: "Saved" };
    });
    const user = userEvent.setup();
    render(
      <AdminChallengeForm
        mode="create"
        defaults={defaults}
        starters={[]}
        draftAction={action}
      />,
    );
    const submit = screen.getByRole("button", {
      name: "Create challenge draft",
    });
    await user.click(submit);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await screen.findByRole("status");
    const nextSubmit = screen.getByRole("button", {
      name: "Create challenge draft",
    });
    await waitFor(() => expect(nextSubmit).toBeEnabled());
    await user.click(nextSubmit);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(requestIds[0]).not.toBe(requestIds[1]);
  });

  it("authors every supported meter boundary and caps tempo at manifest v3", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AdminChallengeForm mode="create" defaults={defaults} starters={[]} />,
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Enable meter rule" }),
    );
    const numerator = screen.getByRole("spinbutton", {
      name: "Time signature numerator",
    });
    await user.clear(numerator);
    await user.type(numerator, "32");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Time signature denominator" }),
      "32",
    );

    const payload = JSON.parse(
      (container.querySelector('input[name="payload"]') as HTMLInputElement)
        .value,
    );
    expect(payload.constraints.timeSignature).toEqual({
      numerator: 32,
      denominator: 32,
    });
    const tempoInputs = screen.getByRole("group", { name: "Tempo (BPM)" });
    for (const input of tempoInputs.querySelectorAll('input[type="number"]')) {
      expect(input).toHaveAttribute("max", "300");
    }
  });
});
