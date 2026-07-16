"use client";

import { useActionState, useState } from "react";
import { requestAccountDeletionAction, type FormState } from "./actions";

export function AccountDeletionForm({ username }: { username: string }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(
    requestAccountDeletionAction,
    {},
  );
  return (
    <form action={action} className="mt-5">
      <input type="hidden" name="requestId" value={requestId} />
      <label className="font-semibold" htmlFor="account-delete-confirmation">
        Type {username} to confirm
      </label>
      <input
        id="account-delete-confirmation"
        name="username"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        className="border-strong bg-canvas rounded-control mt-2 min-h-11 w-full border px-4"
      />
      {state.message && (
        <p role="alert" className="text-danger mt-3">
          {state.message}
        </p>
      )}
      <button
        className="border-danger text-danger mt-5 min-h-11 rounded-full border px-5 font-semibold disabled:opacity-40"
        disabled={pending || confirmation !== username}
      >
        {pending ? "Starting deletion…" : "Delete account"}
      </button>
    </form>
  );
}
