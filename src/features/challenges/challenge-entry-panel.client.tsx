"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";
import type {
  ChallengeRevisionOption,
  MyChallengeEntry,
} from "./entry-contract";
import {
  preflightChallengeEntryAction,
  submitChallengeEntryAction,
} from "./entry-actions";
import { initialChallengeEntryActionState } from "./entry-action-state";

export function ChallengeEntryPanel({
  challengeId,
  challengeVersionId,
  slug,
  options,
  myEntry,
}: {
  challengeId: string;
  challengeVersionId: string;
  slug: string;
  options: ChallengeRevisionOption[];
  myEntry: MyChallengeEntry | null;
}) {
  const router = useRouter();
  const [revisionId, setRevisionId] = useState(options[0]?.revisionId ?? "");
  const requestIdRef = useRef<HTMLInputElement>(null);
  const [preflightState, preflightAction, preflightPending] = useActionState(
    preflightChallengeEntryAction,
    initialChallengeEntryActionState,
  );
  const [submitState, submitAction, submitPending] = useActionState(
    submitChallengeEntryAction,
    initialChallengeEntryActionState,
  );
  const selected = options.find((option) => option.revisionId === revisionId);
  const preflight =
    preflightState.preflight?.revisionId === revisionId
      ? preflightState.preflight
      : null;

  useEffect(() => {
    if (submitState.status !== "success") return;
    router.refresh();
  }, [router, submitState.entryId, submitState.status]);

  return (
    <section
      className="border-subtle bg-surface rounded-card mt-10 border p-6 sm:p-8"
      aria-labelledby="entry-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-accent font-mono text-xs tracking-widest uppercase">
            Exact revision entry
          </p>
          <h2 id="entry-heading" className="mt-2 text-2xl font-bold">
            Preflight your current revision
          </h2>
        </div>
        {myEntry && (
          <span className="border-accent text-accent rounded-full border px-4 py-2 text-sm font-semibold">
            My entry · revision {myEntry.revisionNumber}
          </span>
        )}
      </div>

      {myEntry && (
        <div className="border-subtle bg-surface-soft rounded-control mt-5 border p-4">
          <p className="font-semibold">{myEntry.projectTitle}</p>
          <p className="text-muted mt-1 text-sm">
            Submitted {new Date(myEntry.submittedAt).toLocaleString()} · exact
            immutable revision {myEntry.revisionNumber}
          </p>
          <p className="text-muted mt-2 text-sm">
            Replacing this entry appends a new entry and permanently closes this
            active row. It never edits the revision already submitted.
          </p>
        </div>
      )}

      {options.length === 0 ? (
        <div className="mt-6">
          <p className="text-muted">
            Sign in as an active project owner with a current published revision
            to preflight this challenge.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="cta-gradient text-accent-contrast rounded-full px-5 py-3 font-semibold"
              href={`/sign-in?next=/challenges/${slug}`}
            >
              Sign in
            </Link>
            <Link
              className="border-strong rounded-full border px-5 py-3 font-semibold"
              href="/projects"
            >
              Open your projects
            </Link>
          </div>
        </div>
      ) : (
        <>
          <form action={preflightAction} className="mt-6">
            <input type="hidden" name="challengeId" value={challengeId} />
            <input
              type="hidden"
              name="challengeVersionId"
              value={challengeVersionId}
            />
            <label htmlFor="challenge-revision" className="block font-semibold">
              Current immutable project revision
            </label>
            <select
              id="challenge-revision"
              name="revisionId"
              value={revisionId}
              onChange={(event) => setRevisionId(event.target.value)}
              className="border-strong bg-surface rounded-control mt-2 min-h-12 w-full border px-4"
            >
              {options.map((option) => (
                <option key={option.revisionId} value={option.revisionId}>
                  {option.projectTitle} · revision {option.revisionNumber} ·{" "}
                  {option.visibility}
                </option>
              ))}
            </select>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={preflightPending}
                className="cta-gradient text-accent-contrast min-h-11 rounded-full px-6 font-semibold disabled:cursor-wait disabled:opacity-70"
              >
                {preflightPending
                  ? "Checking exact revision…"
                  : "Run eligibility preflight"}
              </button>
              {selected && (
                <>
                  <Link
                    className="border-strong inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
                    href={`/projects/${selected.projectId}`}
                  >
                    View project
                  </Link>
                  <Link
                    className="border-strong inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
                    href={`/studio/${selected.projectId}`}
                  >
                    Correct in Studio
                  </Link>
                </>
              )}
            </div>
          </form>

          {preflightState.message && (
            <p
              className={`rounded-control mt-5 border p-4 ${preflightState.status === "error" || (preflight && !preflight.evaluation.eligible) ? "border-danger text-danger" : "border-accent text-ink"}`}
              role={preflightState.status === "error" ? "alert" : "status"}
            >
              {preflightState.message}
            </p>
          )}

          {preflight && (
            <div className="mt-7" aria-labelledby="preflight-results-heading">
              <h3 id="preflight-results-heading" className="text-xl font-bold">
                Every constraint result
              </h3>
              <p className="text-muted mt-2 text-sm">
                Advisory feedback for {preflight.projectTitle}, revision{" "}
                {preflight.revisionNumber}. Postgres will independently extract
                the facts and re-run every rule at submission.
              </p>
              <ul className="mt-4 space-y-3">
                {preflight.evaluation.rules.map((rule) => (
                  <li
                    key={rule.rule}
                    className="border-subtle bg-surface-soft rounded-control border p-4"
                  >
                    <div className="flex gap-3">
                      {rule.passed ? (
                        <FiCheckCircle
                          className="text-accent mt-0.5 shrink-0 text-xl"
                          aria-hidden="true"
                        />
                      ) : (
                        <FiXCircle
                          className="text-danger mt-0.5 shrink-0 text-xl"
                          aria-hidden="true"
                        />
                      )}
                      <div>
                        <p className="font-semibold">
                          {rule.passed ? "Pass" : "Needs change"} ·{" "}
                          {rule.rule.replaceAll("_", " ")}
                        </p>
                        <p className="mt-1">{rule.message}</p>
                        <p className="text-muted mt-2 text-xs">
                          Observed: {formatFact(rule.observed)} · Required:{" "}
                          {formatFact(rule.required)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preflight?.evaluation.eligible && (
            <form
              action={submitAction}
              onSubmit={() => {
                if (requestIdRef.current)
                  requestIdRef.current.value = crypto.randomUUID();
              }}
              className="border-accent rounded-card mt-7 border p-5"
            >
              <input type="hidden" name="challengeId" value={challengeId} />
              <input
                type="hidden"
                name="challengeVersionId"
                value={challengeVersionId}
              />
              <input
                type="hidden"
                name="revisionId"
                value={preflight.revisionId}
              />
              <input type="hidden" name="slug" value={slug} />
              <input
                ref={requestIdRef}
                type="hidden"
                name="requestId"
                defaultValue=""
              />
              <input
                type="hidden"
                name="expectedActiveEntryId"
                value={myEntry?.entryId ?? ""}
              />
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="displayAttestation"
                  value="challenge-display-attestation-v1"
                  className="mt-1 size-5 shrink-0"
                  required
                />
                <span>
                  <strong>
                    I authorize challenge-scoped public display of this exact
                    revision.
                  </strong>{" "}
                  When voting opens, OpenMIDI may publicly show its synthesized
                  preview data, project-title snapshot, entrant credit, revision
                  message, and required attribution, and retain them with
                  completed results. This does not make my project generally
                  public or grant downloads, editable copies, or library reuse.
                </span>
              </label>
              <button
                type="submit"
                disabled={submitPending}
                className="cta-gradient text-accent-contrast mt-5 min-h-11 rounded-full px-6 font-semibold disabled:cursor-wait disabled:opacity-70"
              >
                {submitPending
                  ? "Rechecking in Postgres…"
                  : myEntry
                    ? "Replace active entry with this exact revision"
                    : "Submit this exact revision"}
              </button>
            </form>
          )}

          {submitState.message && (
            <p
              className={`rounded-control mt-5 border p-4 ${submitState.status === "error" ? "border-danger text-danger" : "border-accent text-ink"}`}
              role={submitState.status === "error" ? "alert" : "status"}
            >
              {submitState.message}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function formatFact(value: unknown) {
  if (value === null) return "none";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  return JSON.stringify(value)
    .replaceAll(/[{}\[\]"]/g, "")
    .replaceAll(",", ", ")
    .replaceAll(":", ": ");
}
