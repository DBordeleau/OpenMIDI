"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createWorkspaceAction, type CreateWorkspaceState } from "./actions";

export function CreateWorkspaceForm({
  projectId,
  currentRevisionId,
  autoStart = false,
}: {
  projectId: string;
  currentRevisionId: string;
  autoStart?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const startedRef = useRef(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const action = useMemo(
    () => createWorkspaceAction.bind(null, projectId),
    [projectId],
  );
  const [state, formAction, pending] = useActionState<
    CreateWorkspaceState,
    FormData
  >(action, {});

  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    formRef.current?.requestSubmit();
  }, [autoStart]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-card border-strong bg-surface border p-6"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input
        type="hidden"
        name="expectedCurrentRevisionId"
        value={currentRevisionId}
      />
      <p className="text-muted">
        {autoStart
          ? "Preparing a private editable draft from the latest revision…"
          : "Create a private editable draft from the current immutable revision."}
      </p>
      {state.message && (
        <p role="alert" className="text-danger mt-3">
          {state.message}
        </p>
      )}
      <button
        className={
          autoStart && !state.message
            ? "sr-only"
            : "cta-gradient text-accent-contrast rounded-full px-5 py-3 font-semibold disabled:opacity-50"
        }
        disabled={pending}
      >
        {pending
          ? "Creating draft…"
          : autoStart
            ? "Retry creating draft"
            : "Create editable draft"}
      </button>
    </form>
  );
}
