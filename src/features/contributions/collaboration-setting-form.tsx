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
  bare = false,
}: {
  projectId: string;
  lockVersion: number;
  open: boolean;
  eligible: boolean;
  /** Drop the card chrome so this can sit inside another panel's grid. */
  bare?: boolean;
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
      className={
        bare
          ? "border-subtle bg-surface-soft/45 rounded-control flex h-full flex-col border p-4 sm:p-5"
          : "rounded-card border-subtle mt-8 border p-6"
      }
    >
      {bare && (
        <p className="text-accent font-mono text-[10.5px] tracking-[0.16em] uppercase">
          Contributions
        </p>
      )}
      <h2 className={`font-bold ${bare ? "mt-1.5 text-base" : "text-xl"}`}>
        {bare
          ? `Submissions are ${open ? "open" : "closed"}.`
          : "Contribution submissions"}
      </h2>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        Accept proposals from eligible musicians who can see this project. This
        setting does not change visibility or the project license.
      </p>
      {!bare && (
        <p className="mt-3 font-semibold">
          Submissions are currently {open ? "open" : "closed"}.
        </p>
      )}
      {!eligible && (
        <p className="text-muted mt-3 text-sm leading-relaxed">
          Choose the CC BY 4.0 project license before opening submissions so
          contributors receive explicit reuse terms.
        </p>
      )}
      {state.message && (
        <p role="alert" className="text-danger mt-3 text-sm">
          {state.message}
        </p>
      )}
      <button
        className={`border-strong hover:border-accent min-h-11 rounded-full border px-5 font-semibold transition-colors disabled:opacity-50 ${bare ? "mt-auto self-start" : "mt-5"}`}
        disabled={pending || (!open && !eligible)}
      >
        {pending
          ? "Updating…"
          : open
            ? "Close submissions"
            : "Open submissions"}
      </button>
    </form>
  );
}
