"use client";

import { useActionState, useState } from "react";
import { rejectAdminUploadAction, type FormState } from "./actions";

export function UploadRejectionForm({
  assetId,
  expectedStatus,
}: {
  assetId: string;
  expectedStatus: "reserved" | "uploading" | "processing" | "failed";
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FormState, FormData>(
    rejectAdminUploadAction,
    {},
  );

  return (
    <form action={action} className="flex min-w-64 flex-wrap items-end gap-2">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedStatus" value={expectedStatus} />
      <label className="min-w-0 flex-1 text-sm font-semibold">
        Audit reason
        <input
          name="reason"
          required
          maxLength={500}
          className="border-strong bg-canvas rounded-control mt-1 min-h-11 w-full border px-3"
        />
      </label>
      <button
        className="border-danger text-danger min-h-11 rounded-full border px-4 font-semibold"
        disabled={pending}
      >
        Reject
      </button>
      {state.message && (
        <p className="text-muted w-full text-sm" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
