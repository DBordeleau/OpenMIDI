"use client";

import { useActionState, useState } from "react";
import { applyModerationActionAction, type FormState } from "./actions";

export function AdminActionForm({
  reportId,
  reportStatus,
  targetVersion,
  targetState,
  targetKind,
  targetAccountStatus,
}: {
  reportId: string;
  reportStatus: "submitted" | "reviewing" | "resolved" | "dismissed";
  targetVersion: number;
  targetState: "visible" | "hidden";
  targetKind: "profile" | "project" | "contribution";
  targetAccountStatus: "incomplete" | "active" | "suspended" | "deleted" | null;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FormState, FormData>(
    applyModerationActionAction,
    {},
  );
  return (
    <form
      action={action}
      className="border-subtle mt-8 space-y-4 border-t pt-6"
    >
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedReportStatus" value={reportStatus} />
      <input type="hidden" name="expectedTargetVersion" value={targetVersion} />
      <label className="block font-semibold" htmlFor="admin-reason">
        Audit reason
      </label>
      <textarea
        id="admin-reason"
        name="reason"
        required
        maxLength={500}
        className="border-strong bg-canvas rounded-control min-h-24 w-full border p-4"
      />
      <div className="flex flex-wrap gap-3">
        {reportStatus === "submitted" && (
          <button
            name="action"
            value="assign_self"
            className="border-strong min-h-11 rounded-full border px-5 font-semibold"
            disabled={pending}
          >
            Assign to me
          </button>
        )}
        <button
          name="action"
          value={targetState === "visible" ? "hide" : "restore"}
          className="border-danger text-danger min-h-11 rounded-full border px-5 font-semibold"
          disabled={pending}
        >
          {targetState === "visible" ? "Hide target" : "Restore target"}
        </button>
        {targetKind === "profile" && targetAccountStatus === "active" && (
          <button
            name="action"
            value="suspend_account"
            className="border-danger text-danger min-h-11 rounded-full border px-5 font-semibold"
            disabled={pending}
          >
            Suspend account
          </button>
        )}
        {targetKind === "profile" && targetAccountStatus === "suspended" && (
          <button
            name="action"
            value="restore_account"
            className="border-strong min-h-11 rounded-full border px-5 font-semibold"
            disabled={pending}
          >
            Restore account
          </button>
        )}
        {(reportStatus === "submitted" || reportStatus === "reviewing") && (
          <button
            name="action"
            value="dismiss"
            className="border-strong min-h-11 rounded-full border px-5 font-semibold"
            disabled={pending}
          >
            Dismiss report
          </button>
        )}
      </div>
      {state.message && (
        <p role="alert" className="text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
