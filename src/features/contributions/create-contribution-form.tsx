"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createContributionAction,
  type ContributionActionState,
} from "./actions";

export function CreateContributionForm({
  projectId,
  currentRevisionId,
}: {
  projectId: string;
  currentRevisionId: string;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const action = useMemo(
    () => createContributionAction.bind(null, projectId),
    [projectId],
  );
  const [state, formAction, pending] = useActionState<
    ContributionActionState,
    FormData
  >(action, {});
  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="requestId" value={requestId} />
      <input
        type="hidden"
        name="expectedCurrentRevisionId"
        value={currentRevisionId}
      />
      <label className="block">
        Contribution title
        <input
          className="border-subtle mt-1 block min-h-11 w-full border px-3"
          name="title"
          maxLength={120}
          required
        />
      </label>
      <label className="block">
        Description (optional)
        <textarea
          className="border-subtle mt-1 block min-h-28 w-full border p-3"
          name="description"
          maxLength={5000}
        />
      </label>
      {state.message && (
        <p role="alert" className="text-red-700">
          {state.message}
        </p>
      )}
      <button
        className="bg-accent rounded-control min-h-11 px-5 font-semibold text-slate-950 disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Creating contributionâ€¦" : "Create private contribution"}
      </button>
    </form>
  );
}
