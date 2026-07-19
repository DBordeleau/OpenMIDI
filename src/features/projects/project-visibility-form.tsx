"use client";

import { useActionState, useMemo } from "react";
import {
  setProjectVisibilityAction,
  type ProjectVisibilityState,
} from "./visibility-actions";

export function ProjectVisibilityForm({
  projectId,
  lockVersion,
  visibility,
}: {
  projectId: string;
  lockVersion: number;
  visibility: "private" | "public";
}) {
  const next = visibility === "private" ? "public" : "private";
  const action = useMemo(
    () => setProjectVisibilityAction.bind(null, projectId, lockVersion, next),
    [projectId, lockVersion, next],
  );
  const [state, formAction, pending] = useActionState<ProjectVisibilityState>(
    action,
    {},
  );
  return (
    <form
      action={formAction}
      className="rounded-card border-subtle mt-8 border p-6"
    >
      <p className="text-accent font-mono text-[11px] tracking-[0.16em] uppercase">
        Visibility
      </p>
      <h2 className="mt-2 text-xl font-bold">This project is {visibility}.</h2>
      <p className="text-muted mt-2">
        {visibility === "private"
          ? "Making it public adds safe project and credit metadata to Explore. Private workspaces, manifests, downloads, and Studio access stay private."
          : "Making it private removes it from Explore and hides its public page. Existing contribution drafts keep their exact private workspace access."}
      </p>
      {state.message && (
        <p className="text-danger mt-3" role="alert">
          {state.message}
        </p>
      )}
      <button
        className={
          visibility === "private"
            ? "cta-gradient mt-5 min-h-11 rounded-full px-6 font-semibold disabled:opacity-50"
            : "border-strong hover:border-accent-2 mt-5 min-h-11 rounded-full border px-6 font-semibold disabled:opacity-50"
        }
        disabled={pending}
      >
        {pending
          ? "Updating…"
          : visibility === "private"
            ? "Make project public"
            : "Make project private"}
      </button>
    </form>
  );
}
