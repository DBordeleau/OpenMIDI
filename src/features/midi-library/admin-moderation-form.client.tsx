"use client";

import { useActionState, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminMidiLibraryReport } from "./types";
import {
  applyMidiLibraryModerationActionAction,
  type MidiLibraryActionState,
} from "./detail-actions";

const initialState: MidiLibraryActionState = { status: "idle", message: "" };

export function MidiLibraryAdminModerationForm({
  report,
}: {
  report: AdminMidiLibraryReport;
}) {
  const router = useRouter();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const applyAction = useCallback(
    async (previous: MidiLibraryActionState, formData: FormData) => {
      const next = await applyMidiLibraryModerationActionAction(
        previous,
        formData,
      );
      if (next.status === "success") {
        setRequestId(crypto.randomUUID());
        router.refresh();
      }
      return next;
    },
    [router],
  );
  const [state, action, pending] = useActionState(applyAction, initialState);
  return (
    <form
      action={action}
      className="rounded-card border-subtle bg-surface mt-8 border p-6"
    >
      <input type="hidden" name="reportId" value={report.id} />
      <input type="hidden" name="listingId" value={report.listingId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedReportStatus" value={report.status} />
      <input
        type="hidden"
        name="expectedTargetVersion"
        value={report.targetVersion}
      />
      <h2 className="text-xl font-bold">Record administrator action</h2>
      <p className="text-muted mt-2 text-sm">
        Optimistic target version {report.targetVersion}. Reload after any
        conflict.
      </p>
      <label className="mt-5 block font-semibold">
        Action
        <select
          name="action"
          className="border-strong bg-canvas rounded-control mt-2 min-h-11 w-full border px-4"
          defaultValue="assign_self"
        >
          <option value="assign_self">Assign to me / review</option>
          {report.targetState === "visible" ? (
            <option value="hide">Hide listing from safe public reads</option>
          ) : (
            <option value="restore">
              Restore listing to safe public reads
            </option>
          )}
          <option value="resolve">Resolve report</option>
          <option value="dismiss">Dismiss report</option>
        </select>
      </label>
      <label className="mt-4 block font-semibold">
        Decision note
        <textarea
          name="reason"
          required
          maxLength={500}
          rows={4}
          className="border-strong bg-canvas rounded-control mt-2 w-full border p-4"
        />
      </label>
      {state.status !== "idle" && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`mt-4 ${state.status === "error" ? "text-danger" : "text-accent-2"}`}
        >
          {state.message}
        </p>
      )}
      <button
        disabled={pending}
        className="cta-gradient text-accent-contrast mt-5 min-h-11 rounded-full px-5 font-semibold disabled:opacity-55"
      >
        {pending ? "Applying…" : "Apply action"}
      </button>
    </form>
  );
}
