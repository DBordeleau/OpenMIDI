"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import type { AdminChallengeResults } from "@/server/repositories/challenges";
import {
  finalizeChallengeResultAction,
  moderateChallengeTargetAction,
  setFeaturedChallengeAction,
} from "./admin-results-actions";
import { initialAdminResultsActionState } from "./admin-results-action-state";

export function AdminChallengeResultsPanel({
  data,
}: {
  data: AdminChallengeResults;
}) {
  const challenge = data.challenge;
  const eligibleEntries = data.entries.filter(
    (entry) => entry.status === "active" && entry.moderationState === "visible",
  );
  const [placements, setPlacements] = useState(() =>
    Array.from({ length: challenge.officialPlacementCount }, (_, index) => ({
      place: index + 1,
      entryId:
        challenge.result?.placements[index]?.entryId ??
        eligibleEntries[index]?.entryId ??
        "",
      label:
        challenge.result?.placements[index]?.label ??
        (index === 0 ? "Winner" : `Place ${index + 1}`),
    })),
  );
  const placementPayload = useMemo(
    () => JSON.stringify(placements),
    [placements],
  );
  return (
    <div className="mt-8 space-y-8">
      <section className="border-subtle bg-surface rounded-card border p-6">
        <h2 className="text-2xl font-bold">Canonical feature</h2>
        <p className="text-muted mt-2">
          Current explicit selection:{" "}
          {data.featuredSelection.challengeId ?? "none (fallback)"}
        </p>
        <FeatureForm data={data} />
      </section>
      <section className="border-subtle bg-surface rounded-card border p-6">
        <h2 className="text-2xl font-bold">Challenge moderation</h2>
        <p className="text-muted mt-2">
          {data.reportCount} private reports. Reports never hide content
          automatically.
        </p>
        <ModerationForm
          challenge={challenge}
          action={
            challenge.moderationState === "hidden"
              ? "challenge_restore"
              : "challenge_hide"
          }
          expectedVersion={challenge.moderationVersion ?? 1}
          label={
            challenge.moderationState === "hidden"
              ? "Restore challenge"
              : "Hide challenge"
          }
        />
      </section>
      <section className="border-subtle bg-surface rounded-card border p-6">
        <h2 className="text-2xl font-bold">Submitted reports</h2>
        <p className="text-muted mt-2">
          Private evidence for moderation review. Reporting alone does not hide
          a challenge or entry.
        </p>
        {data.reports.length ? (
          <ul className="mt-4 space-y-4">
            {data.reports.map((report) => (
              <li
                key={report.reportId}
                className="border-subtle rounded-control border p-4"
              >
                <p className="font-semibold">
                  {report.targetKind === "challenge" ? "Challenge" : "Entry"}:{" "}
                  {report.targetLabel}
                </p>
                <p className="text-muted mt-1 text-sm">
                  {report.reason.replaceAll("_", " ")} ·{" "}
                  <time dateTime={report.createdAt}>
                    {new Date(report.createdAt).toLocaleString()}
                  </time>
                </p>
                {report.entryId && (
                  <p className="text-muted mt-1 font-mono text-xs">
                    Entry {report.entryId}
                  </p>
                )}
                <p className="mt-3 whitespace-pre-wrap">
                  {report.details ?? "No additional private details supplied."}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mt-4">No reports have been submitted.</p>
        )}
      </section>
      <section className="border-subtle bg-surface rounded-card border p-6">
        <h2 className="text-2xl font-bold">Entries and included votes</h2>
        <ul className="mt-4 space-y-4">
          {data.entries.map((entry) => (
            <li
              key={entry.entryId}
              className="border-subtle rounded-control border p-4"
            >
              <p className="font-semibold">
                {entry.projectTitle} Â· @{entry.entrantUsername}
              </p>
              <p className="text-muted text-sm">
                {entry.status} Â· {entry.moderationState} Â· {entry.voteTotal}{" "}
                included votes
              </p>
              {entry.status === "active" && (
                <div className="flex flex-wrap gap-3">
                  <ModerationForm
                    challenge={challenge}
                    entryId={entry.entryId}
                    action={
                      entry.moderationState === "hidden"
                        ? "entry_restore"
                        : "entry_hide"
                    }
                    expectedVersion={entry.moderationVersion}
                    label={
                      entry.moderationState === "hidden"
                        ? "Restore entry"
                        : "Hide entry"
                    }
                  />
                  <ModerationForm
                    challenge={challenge}
                    entryId={entry.entryId}
                    action="entry_disqualify"
                    expectedVersion={entry.moderationVersion}
                    label="Disqualify entry"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="border-subtle bg-surface rounded-card border p-6">
        <h2 className="text-2xl font-bold">Vote review</h2>
        <ul className="mt-4 space-y-3">
          {data.votes.map((vote) => (
            <li
              key={vote.voteId}
              className="border-subtle rounded-control border p-4"
            >
              <p className="text-sm">
                Vote {vote.voteId.slice(0, 8)} Â· entry{" "}
                {vote.entryId.slice(0, 8)} Â· {vote.state}
              </p>
              {(vote.state === "active" || vote.state === "excluded") && (
                <ModerationForm
                  challenge={challenge}
                  voteId={vote.voteId}
                  action={
                    vote.state === "excluded" ? "vote_restore" : "vote_exclude"
                  }
                  expectedVersion={vote.voteVersion}
                  label={
                    vote.state === "excluded" ? "Restore vote" : "Exclude vote"
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </section>
      <ResultForm
        data={data}
        placements={placements}
        setPlacements={setPlacements}
        placementPayload={placementPayload}
        eligibleEntries={eligibleEntries}
      />
    </div>
  );
}

function ModerationForm({
  challenge,
  action,
  expectedVersion,
  label,
  entryId = null,
  voteId = null,
}: {
  challenge: AdminChallengeResults["challenge"];
  action:
    | "challenge_hide"
    | "challenge_restore"
    | "entry_hide"
    | "entry_restore"
    | "entry_disqualify"
    | "vote_exclude"
    | "vote_restore";
  expectedVersion: number;
  label: string;
  entryId?: string | null;
  voteId?: string | null;
}) {
  const requestRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    moderateChallengeTargetAction,
    initialAdminResultsActionState,
  );
  return (
    <form
      action={formAction}
      onSubmit={() => {
        if (requestRef.current) requestRef.current.value = crypto.randomUUID();
      }}
      className="mt-3 flex flex-wrap items-end gap-3"
    >
      <input ref={requestRef} type="hidden" name="requestId" defaultValue="" />
      <input type="hidden" name="challengeId" value={challenge.id} />
      <input type="hidden" name="slug" value={challenge.slug} />
      <input type="hidden" name="entryId" value={entryId ?? ""} />
      <input type="hidden" name="voteId" value={voteId ?? ""} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <label className="text-sm">
        <span className="block font-semibold">Audit reason</span>
        <input
          required
          maxLength={500}
          name="reason"
          className="border-strong bg-surface rounded-control mt-1 min-h-10 border px-3"
        />
      </label>
      <button
        disabled={pending}
        className="border-strong min-h-10 rounded-full border px-4 font-semibold"
      >
        {pending ? "Savingâ€¦" : label}
      </button>
      {state.message && (
        <p
          className={
            state.status === "error"
              ? "text-danger w-full text-sm"
              : "text-muted w-full text-sm"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

function FeatureForm({ data }: { data: AdminChallengeResults }) {
  const requestRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(
    setFeaturedChallengeAction,
    initialAdminResultsActionState,
  );
  const selected = data.featuredSelection.challengeId === data.challenge.id;
  return (
    <form
      action={action}
      onSubmit={() => {
        if (requestRef.current) requestRef.current.value = crypto.randomUUID();
      }}
      className="mt-4"
    >
      <input ref={requestRef} type="hidden" name="requestId" defaultValue="" />
      <input
        type="hidden"
        name="challengeId"
        value={selected ? "" : data.challenge.id}
      />
      <input
        type="hidden"
        name="currentChallengeId"
        value={data.challenge.id}
      />
      <input type="hidden" name="slug" value={data.challenge.slug} />
      <input
        type="hidden"
        name="expectedVersion"
        value={data.featuredSelection.version}
      />
      <button
        disabled={pending}
        className="border-strong min-h-11 rounded-full border px-5 font-semibold"
      >
        {selected ? "Clear explicit selection" : "Feature this challenge"}
      </button>
      {state.message && (
        <p
          className={
            state.status === "error" ? "text-danger mt-2" : "text-muted mt-2"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

function ResultForm({
  data,
  placements,
  setPlacements,
  placementPayload,
  eligibleEntries,
}: {
  data: AdminChallengeResults;
  placements: Array<{ place: number; entryId: string; label: string }>;
  setPlacements: React.Dispatch<
    React.SetStateAction<
      Array<{ place: number; entryId: string; label: string }>
    >
  >;
  placementPayload: string;
  eligibleEntries: AdminChallengeResults["entries"];
}) {
  const requestRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(
    finalizeChallengeResultAction,
    initialAdminResultsActionState,
  );
  return (
    <section className="border-accent bg-surface-raised rounded-card border p-6">
      <h2 className="text-2xl font-bold">
        {data.challenge.currentResultId
          ? "Append result correction"
          : "Finalize permanent results"}
      </h2>
      <p className="text-muted mt-2">
        Postgres recomputes all eligible totals and every Community Favorite tie
        in the transaction.
      </p>
      <form
        action={action}
        onSubmit={() => {
          if (requestRef.current)
            requestRef.current.value = crypto.randomUUID();
        }}
        className="mt-5 space-y-4"
      >
        <input
          ref={requestRef}
          type="hidden"
          name="requestId"
          defaultValue=""
        />
        <input type="hidden" name="challengeId" value={data.challenge.id} />
        <input type="hidden" name="slug" value={data.challenge.slug} />
        <input
          type="hidden"
          name="expectedLifecycleVersion"
          value={data.challenge.lifecycleVersion}
        />
        <input
          type="hidden"
          name="expectedCurrentVersionId"
          value={data.challenge.currentVersionId}
        />
        <input
          type="hidden"
          name="expectedCurrentResultId"
          value={data.challenge.currentResultId ?? ""}
        />
        <input type="hidden" name="placements" value={placementPayload} />
        {placements.map((placement, index) => (
          <div
            key={placement.place}
            className="grid gap-3 sm:grid-cols-[5rem_1fr_1fr]"
          >
            <span className="font-semibold">Place {placement.place}</span>
            <select
              value={placement.entryId}
              onChange={(event) =>
                setPlacements((current) =>
                  current.map((item, i) =>
                    i === index
                      ? { ...item, entryId: event.target.value }
                      : item,
                  ),
                )
              }
              className="border-strong bg-surface rounded-control min-h-11 border px-3"
            >
              <option value="">Choose entry</option>
              {eligibleEntries.map((entry) => (
                <option key={entry.entryId} value={entry.entryId}>
                  {entry.projectTitle} Â· @{entry.entrantUsername}
                </option>
              ))}
            </select>
            <input
              value={placement.label}
              onChange={(event) =>
                setPlacements((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, label: event.target.value } : item,
                  ),
                )
              }
              maxLength={80}
              className="border-strong bg-surface rounded-control min-h-11 border px-3"
              aria-label={`Place ${placement.place} label`}
            />
          </div>
        ))}
        <label className="block">
          <span className="font-semibold">Public result note</span>
          <textarea
            required
            name="publicNote"
            maxLength={2000}
            rows={4}
            defaultValue={data.challenge.result?.note ?? ""}
            className="border-strong bg-surface rounded-control mt-2 w-full border p-3"
          />
        </label>
        {data.challenge.currentResultId && (
          <label className="block">
            <span className="font-semibold">Private correction reason</span>
            <textarea
              required
              name="correctionReason"
              maxLength={500}
              rows={2}
              className="border-strong bg-surface rounded-control mt-2 w-full border p-3"
            />
          </label>
        )}
        <button
          disabled={pending || eligibleEntries.length === 0}
          className="cta-gradient text-accent-contrast min-h-11 rounded-full px-6 font-semibold"
        >
          {pending
            ? "Recomputing in Postgresâ€¦"
            : data.challenge.currentResultId
              ? "Append complete correction"
              : "Finalize results"}
        </button>
        {state.message && (
          <p
            className={state.status === "error" ? "text-danger" : "text-muted"}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}
