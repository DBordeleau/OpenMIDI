"use client";

import { useActionState, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import {
  submitMidiLibraryReportAction,
  type MidiLibraryActionState,
} from "./detail-actions";

const initialState: MidiLibraryActionState = { status: "idle", message: "" };

export function MidiLibraryReportForm({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(
    submitMidiLibraryReportAction,
    initialState,
  );
  if (!open && state.status !== "success") {
    return (
      <button
        type="button"
        className="text-muted hover:text-danger mt-8 inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-2 text-sm underline"
        onClick={() => setOpen(true)}
      >
        <FiAlertTriangle aria-hidden="true" />
        Report unoriginal or unauthorized work
      </button>
    );
  }
  if (state.status === "success") {
    return (
      <div className="border-subtle rounded-card mt-8 border p-5" role="status">
        <p className="font-semibold">Report received</p>
        <p className="text-muted mt-2 text-sm">{state.message}</p>
        <p className="text-muted mt-2 font-mono text-xs break-all">
          Reference: {state.referenceId}
        </p>
      </div>
    );
  }
  return (
    <form
      action={action}
      className="border-subtle bg-surface rounded-card mt-8 border p-5"
    >
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="requestId" value={requestId} />
      <h2 className="text-xl font-bold">
        Report unoriginal or unauthorized work
      </h2>
      <p className="text-muted mt-2 text-sm">
        This sends private evidence to administrators. A report alone never
        hides the listing.
      </p>
      <label className="mt-5 block font-semibold">
        Your relationship to the work
        <select
          name="claimantRole"
          className="border-strong bg-canvas rounded-control mt-2 min-h-11 w-full border px-4"
          defaultValue="observer"
        >
          <option value="rightsholder">I am the rightsholder</option>
          <option value="authorized_representative">
            I represent the rightsholder
          </option>
          <option value="observer">I noticed a possible source match</option>
          <option value="other">Another relationship</option>
        </select>
      </label>
      <label className="mt-4 block font-semibold">
        Original work title{" "}
        <span className="text-muted font-normal">(optional)</span>
        <input
          name="originalWorkTitle"
          maxLength={160}
          className="border-strong bg-canvas rounded-control mt-2 min-h-11 w-full border px-4"
        />
      </label>
      <label className="mt-4 block font-semibold">
        Source URL{" "}
        <span className="text-muted font-normal">(optional, HTTPS)</span>
        <input
          name="sourceUrl"
          type="url"
          maxLength={500}
          placeholder="https://"
          className="border-strong bg-canvas rounded-control mt-2 min-h-11 w-full border px-4"
        />
      </label>
      <label className="mt-4 block font-semibold">
        Private evidence
        <textarea
          name="evidence"
          required
          minLength={20}
          maxLength={2000}
          rows={6}
          className="border-strong bg-canvas rounded-control mt-2 w-full border p-4"
        />
      </label>
      {state.status === "error" && (
        <p role="alert" className="text-danger mt-4">
          {state.message}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          disabled={pending}
          className="cta-gradient text-accent-contrast min-h-11 rounded-full px-5 font-semibold disabled:opacity-55"
        >
          {pending ? "Sending…" : "Send private report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border-strong min-h-11 rounded-full border px-5 font-semibold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
