"use client";

import { useActionState, useState } from "react";
import { deleteContributionAction, type FormState } from "./actions";

export function ContributionDeletionForm({
  contributionId,
}: {
  contributionId: string;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FormState, FormData>(
    deleteContributionAction,
    {},
  );
  return (
    <form action={action} className="border-danger/50 mt-8 border-t pt-6">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="contributionId" value={contributionId} />
      <h2 className="text-xl font-bold">Delete this contribution</h2>
      <p className="text-muted mt-2">
        It disappears immediately and can be recovered for 30 days. Accepted
        contributions and held records cannot be deleted.
      </p>
      {state.message && (
        <p role="alert" className="text-danger mt-3">
          {state.message}
        </p>
      )}
      <button
        className="border-danger text-danger mt-4 min-h-11 rounded-full border px-5 font-semibold"
        disabled={pending}
      >
        {pending ? "Deleting…" : "Delete contribution"}
      </button>
    </form>
  );
}
