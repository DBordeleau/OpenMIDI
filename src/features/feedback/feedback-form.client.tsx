"use client";

import { useActionState, useRef, useState } from "react";
import { submitFeedbackAction } from "./actions";
import type { FeedbackFormState } from "./types";

const initialState: FeedbackFormState = {};

type FeedbackAction = (
  state: FeedbackFormState,
  formData: FormData,
) => Promise<FeedbackFormState>;

export function FeedbackForm({
  sourcePathname,
  applicationVersion,
  feedbackAction = submitFeedbackAction,
}: {
  sourcePathname: string;
  applicationVersion: string;
  feedbackAction?: FeedbackAction;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<"bug" | "suggestion">("bug");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [includeBrowserContext, setIncludeBrowserContext] = useState(false);
  const [browserContext, setBrowserContext] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (previousState: FeedbackFormState, formData: FormData) => {
      const nextState = await feedbackAction(previousState, formData);
      if (nextState.referenceId) {
        formRef.current?.reset();
        setKind("bug");
        setSummary("");
        setDetails("");
        setIncludeBrowserContext(false);
        setBrowserContext("");
        setRequestId(crypto.randomUUID());
      }
      return nextState;
    },
    initialState,
  );

  function toggleBrowserContext(checked: boolean) {
    setIncludeBrowserContext(checked);
    setBrowserContext(checked ? navigator.userAgent.slice(0, 300) : "");
  }

  return (
    <form ref={formRef} action={action} className="mt-8 space-y-7">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="sourcePathname" value={sourcePathname} />

      <fieldset>
        <legend className="font-semibold">What are you sharing?</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="border-strong has-checked:border-accent has-checked:bg-surface-raised rounded-control flex cursor-pointer gap-3 border p-4">
            <input
              type="radio"
              name="kind"
              value="bug"
              checked={kind === "bug"}
              onChange={() => setKind("bug")}
            />
            <span>
              <strong className="block">Report a bug</strong>
              <span className="text-muted text-sm">
                Something feels broken or behaves unexpectedly.
              </span>
            </span>
          </label>
          <label className="border-strong has-checked:border-accent has-checked:bg-surface-raised rounded-control flex cursor-pointer gap-3 border p-4">
            <input
              type="radio"
              name="kind"
              value="suggestion"
              checked={kind === "suggestion"}
              onChange={() => setKind("suggestion")}
            />
            <span>
              <strong className="block">Make a suggestion</strong>
              <span className="text-muted text-sm">
                An idea could make the session flow better.
              </span>
            </span>
          </label>
        </div>
        {state.fieldErrors?.kind && (
          <p className="text-danger mt-2 text-sm">{state.fieldErrors.kind}</p>
        )}
      </fieldset>

      <div>
        <label className="font-semibold" htmlFor="feedback-summary">
          Summary
        </label>
        <p id="feedback-summary-help" className="text-muted mt-1 text-sm">
          5–120 characters. Give the team the headline.
        </p>
        <input
          id="feedback-summary"
          name="summary"
          required
          minLength={5}
          maxLength={120}
          aria-describedby="feedback-summary-help"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          className="border-strong bg-canvas rounded-control mt-2 min-h-11 w-full border px-4 py-3"
        />
        {state.fieldErrors?.summary && (
          <p className="text-danger mt-2 text-sm">
            {state.fieldErrors.summary}
          </p>
        )}
      </div>

      <div>
        <label className="font-semibold" htmlFor="feedback-details">
          Details
        </label>
        <p id="feedback-details-help" className="text-muted mt-1 text-sm">
          20–4,000 characters. Tell us what you expected and what happened.
        </p>
        <textarea
          id="feedback-details"
          name="details"
          required
          minLength={20}
          maxLength={4000}
          aria-describedby="feedback-details-help"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          className="border-strong bg-canvas rounded-control mt-2 min-h-40 w-full border p-4"
        />
        {state.fieldErrors?.details && (
          <p className="text-danger mt-2 text-sm">
            {state.fieldErrors.details}
          </p>
        )}
      </div>

      <section
        className="rounded-card border-subtle bg-surface border p-5"
        aria-labelledby="captured-context-heading"
      >
        <h2 id="captured-context-heading" className="font-semibold">
          Context included with this feedback
        </h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Application pathname</dt>
            <dd className="mt-1 font-mono break-all">{sourcePathname}</dd>
          </div>
          <div>
            <dt className="text-muted">Application version</dt>
            <dd className="mt-1 font-mono break-all">{applicationVersion}</dd>
          </div>
        </dl>
        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="includeBrowserContext"
            checked={includeBrowserContext}
            onChange={(event) => toggleBrowserContext(event.target.checked)}
          />
          <span>
            <strong className="block">
              Share browser and platform context
            </strong>
            <span className="text-muted text-sm">
              Optional. We only fill this in after you opt in, and you can edit
              it before sending.
            </span>
          </span>
        </label>
        {includeBrowserContext && (
          <div className="mt-4">
            <label className="text-sm font-semibold" htmlFor="browser-context">
              Browser/platform text that will be sent
            </label>
            <textarea
              id="browser-context"
              name="browserContext"
              required
              maxLength={300}
              value={browserContext}
              onChange={(event) => setBrowserContext(event.target.value)}
              className="border-strong bg-canvas rounded-control mt-2 min-h-24 w-full border p-3 font-mono text-sm"
            />
          </div>
        )}
        {!includeBrowserContext && (
          <input type="hidden" name="browserContext" value="" />
        )}
        {state.fieldErrors?.browserContext && (
          <p className="text-danger mt-2 text-sm">
            {state.fieldErrors.browserContext}
          </p>
        )}
      </section>

      <p className="text-muted text-sm">
        Please don’t paste passwords, tokens, private links, sensitive personal
        information, logs, or complete MIDI manifests. Feedback has no
        attachments.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="cta-gradient text-accent-contrast min-h-11 rounded-full px-6 py-3 font-semibold disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Sending feedback…" : "Send feedback"}
      </button>

      <div
        aria-live="polite"
        role={
          state.message ? (state.referenceId ? "status" : "alert") : undefined
        }
      >
        {state.message && (
          <p
            className={
              state.referenceId ? "text-accent font-semibold" : "text-danger"
            }
          >
            {state.message}
          </p>
        )}
        {state.referenceId && (
          <div className="border-accent rounded-control mt-3 border p-4">
            <p className="text-muted text-sm">Your reference ID</p>
            <p className="mt-1 font-mono text-lg font-bold">
              {state.referenceId}
            </p>
            <p className="text-muted mt-2 text-sm">
              Keep this ID if you need to mention the report to the beta team.
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
