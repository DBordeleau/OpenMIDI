"use client";

import { useRef, useState, useTransition } from "react";
import { reviewContributionAction } from "./actions";
import type { ContributionReviewDecision } from "./types";

export function ReviewContributionForm({
  projectId,
  contributionId,
  contributionTitle,
  currentVersionId,
  currentVersionNumber,
  currentProjectRevisionId,
  stale,
}: {
  projectId: string;
  contributionId: string;
  contributionTitle: string;
  currentVersionId: string;
  currentVersionNumber: number;
  currentProjectRevisionId: string;
  stale: boolean;
}) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const request = useRef<{
    decision: ContributionReviewDecision;
    id: string;
  } | null>(null);

  const review = (decision: ContributionReviewDecision) => {
    if (decision !== "accept" && !note.trim()) {
      setMessage("Add a review note before requesting changes or rejecting.");
      return;
    }
    if (
      decision === "accept" &&
      !confirm(
        `Accept version ${currentVersionNumber} of “${contributionTitle}” as immutable project history?`,
      )
    )
      return;
    if (
      decision === "reject" &&
      !confirm("Reject and archive this contribution workspace?")
    )
      return;
    if (!request.current || request.current.decision !== decision)
      request.current = { decision, id: crypto.randomUUID() };
    const requestId = request.current.id;
    setMessage("");
    startTransition(async () => {
      const result = await reviewContributionAction(projectId, {
        contributionId,
        requestId,
        decision,
        expectedStatus: "submitted",
        expectedCurrentVersionId: currentVersionId,
        expectedProjectRevisionId: currentProjectRevisionId,
        note,
      });
      if (!result.ok) {
        setMessage(
          result.code === "stale_base"
            ? "The project advanced. This exact contribution can no longer be accepted; request changes so the contributor can rebase."
            : result.code === "conflict"
              ? "The contribution or project changed. Reload before reviewing."
              : result.code === "invalid_request"
                ? "Check the review note and try again."
                : "The review could not be completed. Retry safely with the same inputs.",
        );
        return;
      }
      request.current = null;
      setMessage(
        result.reason === "base_outdated"
          ? "The project advanced. Changes were requested automatically; no revision was created."
          : result.status === "accepted"
            ? `Accepted as revision ${result.revisionNumber}.`
            : result.status === "rejected"
              ? "Contribution rejected and workspace archived."
              : "Changes requested. The contributor can edit and submit a new version.",
      );
    });
  };

  return (
    <section className="rounded-card border-strong mt-10 border p-6">
      <h2 className="text-2xl font-bold">Owner review</h2>
      {stale && (
        <p className="mt-3" role="alert">
          The project has advanced since this contribution was submitted.
          Acceptance is blocked for this exact base. Request changes so the
          contributor can rebase; Jam Session will not merge automatically.
        </p>
      )}
      <label className="mt-5 block font-semibold" htmlFor="review-note">
        Review note
      </label>
      <textarea
        id="review-note"
        className="rounded-control border-strong mt-2 min-h-32 w-full border p-3"
        maxLength={5000}
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          request.current = null;
        }}
        placeholder="Required for changes requested or rejection; optional for acceptance."
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-control border-strong min-h-11 border px-4"
          disabled={pending}
          type="button"
          onClick={() => review("request_changes")}
        >
          Request changes
        </button>
        <button
          className="rounded-control border-strong min-h-11 border px-4"
          disabled={pending}
          type="button"
          onClick={() => review("reject")}
        >
          Reject
        </button>
        <button
          className="bg-accent rounded-control min-h-11 px-5 font-semibold text-slate-950"
          disabled={pending}
          type="button"
          onClick={() => review("accept")}
        >
          {pending ? "Reviewing…" : "Accept contribution"}
        </button>
      </div>
      {message && (
        <p className="mt-4" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
