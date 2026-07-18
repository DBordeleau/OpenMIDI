"use client";

import { useActionState, useRef } from "react";
import { FiFlag, FiHeart } from "react-icons/fi";
import {
  reportChallengeContentAction,
  setChallengeVoteAction,
} from "./community-actions";
import { initialChallengeCommunityActionState } from "./community-action-state";

export function ChallengeVoteControl({
  entryId,
  slug,
  initiallyActive,
}: {
  entryId: string;
  slug: string;
  initiallyActive: boolean;
}) {
  const requestRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(
    setChallengeVoteAction,
    initialChallengeCommunityActionState,
  );
  const active = state.active ?? initiallyActive;
  return (
    <form
      action={action}
      onSubmit={() => {
        if (requestRef.current) requestRef.current.value = crypto.randomUUID();
      }}
      className="mt-4"
    >
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="active" value={String(!active)} />
      <input ref={requestRef} type="hidden" name="requestId" defaultValue="" />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={active}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-5 font-semibold disabled:cursor-wait disabled:opacity-70 ${active ? "border-accent text-accent" : "border-strong"}`}
      >
        <FiHeart aria-hidden="true" />
        {pending
          ? "Saving voteâ€¦"
          : active
            ? "Your vote"
            : "Vote for this entry"}
      </button>
      {state.message && (
        <p
          className={`mt-2 text-sm ${state.status === "error" ? "text-danger" : "text-muted"}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ChallengeReportControl({
  challengeId,
  entryId = null,
  slug,
}: {
  challengeId: string;
  entryId?: string | null;
  slug: string;
}) {
  const requestRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(
    reportChallengeContentAction,
    initialChallengeCommunityActionState,
  );
  return (
    <details className="border-subtle rounded-control mt-6 border p-4">
      <summary className="inline-flex cursor-pointer items-center gap-2 font-semibold">
        <FiFlag aria-hidden="true" /> Report{" "}
        {entryId ? "this entry" : "this challenge"}
      </summary>
      <form
        action={action}
        onSubmit={() => {
          if (requestRef.current)
            requestRef.current.value = crypto.randomUUID();
        }}
        className="mt-4 space-y-4"
      >
        <input
          ref={requestRef}
          type="hidden"
          name="requestId"
          defaultValue=""
        />
        <input
          type="hidden"
          name="targetKind"
          value={entryId ? "entry" : "challenge"}
        />
        <input type="hidden" name="challengeId" value={challengeId} />
        <input type="hidden" name="entryId" value={entryId ?? ""} />
        <input type="hidden" name="slug" value={slug} />
        <label className="block">
          <span className="text-sm font-semibold">Reason</span>
          <select
            name="reason"
            className="border-strong bg-surface rounded-control mt-2 min-h-11 w-full border px-3"
          >
            <option value="spam">Spam</option>
            <option value="harassment">Harassment</option>
            <option value="rights_concern">Rights concern</option>
            <option value="vote_manipulation">Vote manipulation</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">
            Private details (optional)
          </span>
          <textarea
            name="details"
            maxLength={1000}
            rows={3}
            className="border-strong bg-surface rounded-control mt-2 w-full border p-3"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="border-strong min-h-11 rounded-full border px-5 font-semibold"
        >
          {pending ? "Recording reportâ€¦" : "Send private report"}
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
    </details>
  );
}
