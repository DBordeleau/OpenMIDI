"use client";

import { useActionState, useState } from "react";
import {
  initialChallengeFormActionState,
  type ChallengeFormActionState,
} from "./action-state";
import { mutateChallengeLifecycleAction } from "./actions";
import type { Challenge } from "./types";

export function AdminChallengeLifecycle({
  challenge,
}: {
  challenge: Challenge;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(
    async (previous: ChallengeFormActionState, formData: FormData) => {
      const next = await mutateChallengeLifecycleAction(previous, formData);
      if (next.status === "success") setRequestId(crypto.randomUUID());
      return next;
    },
    initialChallengeFormActionState,
  );
  if (challenge.state !== "draft" && challenge.state !== "published")
    return null;
  return (
    <form
      action={action}
      className="border-subtle bg-surface rounded-card mt-8 space-y-4 border p-5"
    >
      <input type="hidden" name="challengeId" value={challenge.id} />
      <input type="hidden" name="requestId" value={requestId} />
      <input
        type="hidden"
        name="expectedLifecycleVersion"
        value={challenge.lifecycleVersion}
      />
      <input
        type="hidden"
        name="expectedCurrentVersionId"
        value={challenge.currentVersionId}
      />
      <h2 className="text-xl font-bold">Lifecycle commands</h2>
      {challenge.state === "draft" && (
        <button
          name="action"
          value="publish"
          disabled={pending}
          className="cta-gradient text-accent-contrast min-h-11 rounded-full px-6 font-semibold"
        >
          Publish immutable version
        </button>
      )}
      <label className="block text-sm font-semibold">
        Public-safe cancellation note
        <textarea
          name="reason"
          minLength={1}
          maxLength={500}
          className="border-strong bg-canvas rounded-control mt-2 min-h-24 w-full border p-3"
        />
      </label>
      <button
        name="action"
        value="cancel"
        disabled={pending}
        className="border-danger text-danger min-h-11 rounded-full border px-6 font-semibold"
      >
        Cancel challenge
      </button>
      {state.message && (
        <p
          role={state.status === "success" ? "status" : "alert"}
          className={state.status === "error" ? "text-danger" : ""}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
