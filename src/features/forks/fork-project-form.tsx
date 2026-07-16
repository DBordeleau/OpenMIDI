"use client";

import { useActionState, useMemo, useState } from "react";
import { forkProjectAction, type ForkProjectState } from "./actions";
import {
  defaultForkTitle,
  FORK_RIGHTS_ATTESTATION_TEXT,
  FORK_RIGHTS_ATTESTATION_VERSION,
} from "./schema";
import type { ForkSource } from "./types";

export function ForkProjectForm({ source }: { source: ForkSource }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const action = useMemo(
    () =>
      forkProjectAction.bind(
        null,
        source.projectId,
        source.revisionId,
        source.license.code,
      ),
    [source.projectId, source.revisionId, source.license.code],
  );
  const [state, formAction, pending] = useActionState<
    ForkProjectState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="requestId" value={requestId} />
      <input
        type="hidden"
        name="rightsAttestationVersion"
        value={FORK_RIGHTS_ATTESTATION_VERSION}
      />
      <div>
        <label className="block font-semibold" htmlFor="fork-title">
          Project title
        </label>
        <input
          className="rounded-control border-strong bg-surface mt-2 min-h-11 w-full border px-3"
          defaultValue={defaultForkTitle(source.projectTitle)}
          id="fork-title"
          maxLength={120}
          name="title"
          required
        />
      </div>
      <div>
        <label className="block font-semibold" htmlFor="fork-description">
          Description
        </label>
        <textarea
          className="rounded-control border-strong bg-surface mt-2 min-h-32 w-full border p-3"
          defaultValue={source.projectDescription ?? ""}
          id="fork-description"
          maxLength={5000}
          name="description"
        />
      </div>
      <label className="border-subtle flex gap-3 border p-4">
        <input type="checkbox" name="attested" required />
        <span>{FORK_RIGHTS_ATTESTATION_TEXT}</span>
      </label>
      {state.message && (
        <p role="alert" className="text-red-700">
          {state.message}
        </p>
      )}
      <button
        className="bg-accent rounded-control min-h-11 px-5 font-semibold text-slate-950 disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Creating fork…" : "Create private fork"}
      </button>
    </form>
  );
}
