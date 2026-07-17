"use client";

import { useActionState, useMemo } from "react";
import {
  setProjectContributionsOpenAction,
  type ContributionActionState,
} from "./actions";

export function CollaborationSettingForm({
  projectId,
  lockVersion,
  open,
  eligible,
}: {
  projectId: string;
  lockVersion: number;
  open: boolean;
  eligible: boolean;
}) {
  const action = useMemo(
    () =>
      setProjectContributionsOpenAction.bind(
        null,
        projectId,
        lockVersion,
        !open,
      ),
    [projectId, lockVersion, open],
  );
  const [state, formAction, pending] = useActionState<ContributionActionState>(
    action,
    {},
  );
  return (
    <form
      action={formAction}
      className="rounded-card border-subtle mt-8 border p-6"
    >
      <h2 className="text-xl font-bold">Contribution submissions</h2>
      <p className="text-muted mt-2">
        Accept proposals from eligible musicians who can see this project. This
        setting does not change visibility or the project license.
      </p>
      <p className="mt-3 font-semibold">
        Submissions are currently {open ? "open" : "closed"}.
      </p>
      {!eligible && (
        <p className="text-muted mt-3">
          Choose the CC BY 4.0 project license before opening submissions so
          contributors receive explicit reuse terms.
        </p>
      )}
      {state.message && (
        <p role="alert" className="mt-3 text-red-700">
          {state.message}
        </p>
      )}
      <button
        className="border-strong mt-5 min-h-11 rounded-full border px-5 font-semibold disabled:opacity-50"
        disabled={pending || (!open && !eligible)}
      >
        {pending
          ? "Updatingâ€¦"
          : open
            ? "Close submissions"
            : "Open submissions"}
      </button>
    </form>
  );
}
