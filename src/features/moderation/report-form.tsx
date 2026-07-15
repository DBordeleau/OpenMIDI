"use client";

import { useActionState, useState } from "react";
import { submitReportAction, type FormState } from "./actions";

export function ReportForm({
  targetKind,
  targetId,
}: {
  targetKind: "profile" | "project" | "contribution";
  targetId: string;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitReportAction,
    {},
  );
  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="targetKind" value={targetKind} />
      <input type="hidden" name="targetId" value={targetId} />
      <div>
        <label className="font-semibold" htmlFor="reason">
          What’s happening?
        </label>
        <select
          id="reason"
          name="reason"
          className="border-strong bg-canvas rounded-control mt-2 min-h-11 w-full border px-4"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Choose a reason
          </option>
          <option value="copyright">Copyright or ownership</option>
          <option value="harassment">Harassment</option>
          <option value="sexual_content">Sexual content</option>
          <option value="hate_or_violence">Hate or violent threats</option>
          <option value="spam">Spam or malware</option>
          <option value="other">Other rule concern</option>
        </select>
      </div>
      <div>
        <label className="font-semibold" htmlFor="detail">
          Optional context
        </label>
        <textarea
          id="detail"
          name="detail"
          maxLength={2000}
          rows={6}
          className="border-strong bg-canvas rounded-control mt-2 w-full border p-4"
        />
      </div>
      {state.message && (
        <p role="alert" className="text-danger">
          {state.message}
        </p>
      )}
      <button
        className="cta-gradient text-accent-contrast min-h-11 rounded-full px-5 font-semibold disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Submitting…" : "Submit private report"}
      </button>
    </form>
  );
}
