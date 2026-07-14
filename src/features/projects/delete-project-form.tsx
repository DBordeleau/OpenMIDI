"use client";

import { useActionState, useMemo, useState } from "react";
import { FiTrash2 } from "react-icons/fi";
import {
  deleteProjectAction,
  type DeleteProjectState,
} from "./delete-project-actions";

export function DeleteProjectForm({
  projectId,
  projectTitle,
  lockVersion,
}: {
  projectId: string;
  projectTitle: string;
  lockVersion: number;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [confirmation, setConfirmation] = useState("");
  const action = useMemo(
    () => deleteProjectAction.bind(null, projectId, lockVersion),
    [projectId, lockVersion],
  );
  const [state, formAction, pending] = useActionState<
    DeleteProjectState,
    FormData
  >(action, {});
  const confirmed = confirmation === projectTitle;

  return (
    <section className="rounded-card border-danger/50 bg-surface mt-8 border p-6">
      <p className="text-danger font-mono text-[11px] tracking-[0.16em] uppercase">
        Danger zone
      </p>
      <h2 className="mt-2 text-xl font-bold">Delete this project</h2>
      <p className="text-muted mt-2">
        The project will disappear immediately. Its history and referenced audio
        remain recoverable for 30 days.
      </p>
      <form action={formAction} className="mt-5">
        <input type="hidden" name="requestId" value={requestId} />
        <label className="block font-semibold" htmlFor="delete-confirmation">
          Type <span className="font-mono">{projectTitle}</span> to confirm
        </label>
        <input
          id="delete-confirmation"
          className="border-strong bg-canvas focus:border-danger rounded-control mt-2 min-h-11 w-full border px-4 outline-none"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
        />
        {state.message && (
          <p role="alert" className="text-danger mt-3">
            {state.message}
          </p>
        )}
        <button
          className="border-danger text-danger hover:bg-danger/10 mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!confirmed || pending}
        >
          <FiTrash2 aria-hidden="true" />
          {pending ? "Deleting…" : "Delete project"}
        </button>
      </form>
    </section>
  );
}
