"use client";

import { useRef, useState } from "react";
import { submitContributionAction } from "./actions";
import {
  CONTRIBUTOR_ATTESTATION_TEXT,
  CONTRIBUTOR_ATTESTATION_VERSION,
} from "./schema";

export function SubmissionPanel({
  projectId,
  contributionId,
  baseRevisionId,
  workspace,
  license,
}: {
  projectId: string;
  contributionId: string;
  baseRevisionId: string;
  workspace: {
    lockVersion: number;
    manifestSha256: string;
    updatedAt: string;
    trackCount: number;
    durationMs: number;
    hasAcknowledgedSave: boolean;
  };
  license: { name: string; url: string; summary: string };
}) {
  const requestId = useRef<string | null>(null);
  const [attested, setAttested] = useState(false);
  const [state, setState] = useState<
    { status: "idle" | "submitting" } | { status: "error"; message: string }
  >({ status: "idle" });

  const submit = async () => {
    requestId.current ??= crypto.randomUUID();
    setState({ status: "submitting" });
    const result = await submitContributionAction(projectId, {
      contributionId,
      requestId: requestId.current,
      expectedWorkspaceLockVersion: workspace.lockVersion,
      expectedBaseRevisionId: baseRevisionId,
      expectedManifestSha256: workspace.manifestSha256,
      expectedLicenseCode: "cc-by-4.0",
      attestationVersion: CONTRIBUTOR_ATTESTATION_VERSION,
      attested,
    });
    if (!result.ok) {
      setState({
        status: "error",
        message:
          result.code === "stale_base"
            ? "The project advanced. This contribution must remain based on its exact revision."
            : result.code === "unsaved"
              ? "Wait for a server-acknowledged save, then reload before submitting."
              : result.code === "closed"
                ? "The project owner has closed submissions."
                : "The contribution could not be submitted. Reload and try again.",
      });
      return;
    }
    location.reload();
  };

  return (
    <section className="rounded-card border-strong mt-8 border p-6">
      <h2 className="text-xl font-bold">Submit immutable version</h2>
      <p className="text-muted mt-2">
        Submitting freezes the last server-acknowledged arrangement and its
        exact immutable MIDI pattern versions for owner review.
      </p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-muted">Exact base revision</dt>
          <dd className="font-mono text-sm">{baseRevisionId}</dd>
        </div>
        <div>
          <dt className="text-muted">Last acknowledged save</dt>
          <dd>{new Date(workspace.updatedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted">Arrangement</dt>
          <dd>
            {workspace.trackCount} tracks Â·{" "}
            {(workspace.durationMs / 1000).toFixed(1)} seconds
          </dd>
        </div>
        <div>
          <dt className="text-muted">Project license</dt>
          <dd>
            <a className="underline" href={license.url}>
              {license.name}
            </a>
            <span className="text-muted block text-sm">{license.summary}</span>
          </dd>
        </div>
      </dl>
      <label className="border-subtle mt-5 flex gap-3 border p-4">
        <input
          type="checkbox"
          checked={attested}
          onChange={(event) => setAttested(event.target.checked)}
        />
        <span>{CONTRIBUTOR_ATTESTATION_TEXT}</span>
      </label>
      {state.status === "error" && (
        <p role="alert" className="mt-4 text-red-700">
          {state.message}
        </p>
      )}
      {!workspace.hasAcknowledgedSave && (
        <p role="status" className="mt-4">
          Open the studio and wait for a server-acknowledged save before
          submitting.
        </p>
      )}
      <button
        className="bg-accent rounded-control mt-5 min-h-11 px-5 font-semibold text-slate-950 disabled:opacity-50"
        type="button"
        disabled={
          !attested ||
          !workspace.hasAcknowledgedSave ||
          state.status === "submitting"
        }
        onClick={() => void submit()}
      >
        {state.status === "submitting"
          ? "Submittingâ€¦"
          : "Submit immutable version"}
      </button>
    </section>
  );
}
