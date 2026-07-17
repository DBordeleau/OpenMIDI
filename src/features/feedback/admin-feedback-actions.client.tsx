"use client";

import { useActionState, useState } from "react";
import {
  mutateAdminFeedbackAction,
  type AdminFeedbackActionState,
} from "./actions";
import type { AdminFeedbackDetail } from "./types";

export function AdminFeedbackActions({
  feedback,
}: {
  feedback: AdminFeedbackDetail;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<
    AdminFeedbackActionState,
    FormData
  >(mutateAdminFeedbackAction, {});

  return (
    <form
      action={action}
      className="border-subtle mt-8 space-y-6 border-t pt-7"
    >
      <input type="hidden" name="feedbackId" value={feedback.id} />
      <input type="hidden" name="requestId" value={requestId} />
      <input
        type="hidden"
        name="expectedLockVersion"
        value={feedback.lockVersion}
      />

      <section aria-labelledby="classification-heading">
        <h2 id="classification-heading" className="text-xl font-semibold">
          Classification
        </h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label
            className="grid gap-2 text-sm font-semibold"
            htmlFor="feedback-kind"
          >
            Kind
            <select
              id="feedback-kind"
              name="kind"
              defaultValue={feedback.kind}
              className="border-strong bg-canvas rounded-control min-h-11 border px-4"
            >
              <option value="bug">Bug report</option>
              <option value="suggestion">Suggestion</option>
            </select>
          </label>
          <button
            name="action"
            value="classify"
            disabled={pending}
            className="border-strong hover:border-accent min-h-11 rounded-full border px-5 font-semibold"
          >
            Save classification
          </button>
        </div>
      </section>

      {feedback.status === "new" ? (
        <section aria-labelledby="handle-heading">
          <h2 id="handle-heading" className="text-xl font-semibold">
            Mark handled
          </h2>
          <label
            className="mt-3 block text-sm font-semibold"
            htmlFor="feedback-note"
          >
            Private note{" "}
            <span className="text-muted font-normal">(optional)</span>
          </label>
          <textarea
            id="feedback-note"
            name="note"
            maxLength={1000}
            className="border-strong bg-canvas rounded-control mt-2 min-h-24 w-full border p-3"
          />
          <button
            name="action"
            value="handle"
            disabled={pending}
            className="cta-gradient text-accent-contrast mt-3 min-h-11 rounded-full px-5 font-semibold"
          >
            Mark handled
          </button>
        </section>
      ) : (
        <section aria-labelledby="reopen-heading">
          <h2 id="reopen-heading" className="text-xl font-semibold">
            Reopen feedback
          </h2>
          <p className="text-muted mt-2 text-sm">
            Reopening clears the private handled note and returns this item to
            the new queue.
          </p>
          <input type="hidden" name="note" value="" />
          <button
            name="action"
            value="reopen"
            disabled={pending}
            className="border-strong hover:border-accent mt-3 min-h-11 rounded-full border px-5 font-semibold"
          >
            Reopen
          </button>
        </section>
      )}

      <details className="border-danger rounded-control border p-4">
        <summary className="text-danger cursor-pointer font-semibold">
          Delete as irrelevant
        </summary>
        <p className="text-muted mt-3 text-sm">
          This permanently removes the summary, details, route, browser context,
          admin note, and submitter relationship. Only the minimal private
          deletion audit remains.
        </p>
        <label
          className="mt-4 block text-sm font-semibold"
          htmlFor="deletion-reason"
        >
          Deletion reason
        </label>
        <textarea
          id="deletion-reason"
          name="deletionReason"
          minLength={5}
          maxLength={500}
          className="border-strong bg-canvas rounded-control mt-2 min-h-24 w-full border p-3"
        />
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input type="checkbox" name="confirmDelete" />
          <span>I understand the submitted content cannot be recovered.</span>
        </label>
        <button
          name="action"
          value="delete"
          disabled={pending}
          className="border-danger text-danger mt-4 min-h-11 rounded-full border px-5 font-semibold"
        >
          Delete irrelevant feedback
        </button>
      </details>

      {state.message && (
        <p role="alert" className="text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
