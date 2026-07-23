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
  bare = false,
}: {
  projectId: string;
  lockVersion: number;
  visibility: "private" | "public";
  /** Drop the card chrome so this can sit inside another panel's grid. */
  bare?: boolean;
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
      className={
        bare
          ? "border-subtle bg-surface-soft/45 rounded-control flex h-full flex-col border p-4 sm:p-5"
          : "rounded-card border-subtle mt-8 border p-6"
      }
    >
      <p className="text-accent font-mono text-[10.5px] tracking-[0.16em] uppercase">
        Visibility
      </p>
      <h2 className="mt-1.5 text-base font-bold">
        This project is {visibility}.
      </h2>
      <p className="text-muted mt-2 text-sm leading-relaxed">
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
        className={`${bare ? "mt-auto self-start" : ""} ${
          visibility === "private"
            ? "cta-gradient mt-5 min-h-11 rounded-full px-6 font-semibold disabled:opacity-50"
            : "border-strong hover:border-accent-2 mt-5 min-h-11 rounded-full border px-6 font-semibold disabled:opacity-50"
        }`}
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
