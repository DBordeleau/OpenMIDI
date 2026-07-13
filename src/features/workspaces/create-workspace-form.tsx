"use client";

import { useActionState, useMemo, useState } from "react";
import { createWorkspaceAction, type CreateWorkspaceState } from "./actions";

export function CreateWorkspaceForm({
  projectId,
  currentRevisionId,
}: {
  projectId: string;
  currentRevisionId: string;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const action = useMemo(
    () => createWorkspaceAction.bind(null, projectId),
    [projectId],
  );
  const [state, formAction, pending] = useActionState<
    CreateWorkspaceState,
    FormData
  >(action, {});
  return (
    <form action={formAction} className="rounded-card border-strong border p-6">
      <input type="hidden" name="requestId" value={requestId} />
      <input
        type="hidden"
        name="expectedCurrentRevisionId"
        value={currentRevisionId}
      />
      <p className="text-muted">
        Create a private editable draft from the current immutable revision.
      </p>
      {state.message && (
        <p role="alert" className="mt-3 text-red-700">
          {state.message}
        </p>
      )}
      <button
        className="bg-accent rounded-control mt-5 min-h-11 px-5 font-semibold text-slate-950 disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Creating draft…" : "Create editable draft"}
      </button>
    </form>
  );
}
