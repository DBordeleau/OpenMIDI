"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useActionState, useState } from "react";
import {
  activateSignupInvitationAction,
  type AdminInviteActionState,
} from "./actions";

type InviteAction = (
  state: AdminInviteActionState,
  formData: FormData,
) => Promise<AdminInviteActionState>;

const initialAdminInviteState: AdminInviteActionState = { status: "idle" };

export function AdminInviteForm({
  inviteAction = activateSignupInvitationAction,
}: {
  inviteAction?: InviteAction;
}) {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(
    async (previousState: AdminInviteActionState, formData: FormData) => {
      const nextState = await inviteAction(previousState, formData);
      if (
        nextState.status === "success" &&
        nextState.outcome !== "already_active"
      )
        setEmail("");
      return nextState;
    },
    initialAdminInviteState,
  );
  const reducedMotion = useReducedMotion();

  return (
    <form action={action} className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="block text-sm font-semibold" htmlFor="beta-email">
            Collaborator email
          </label>
          <input
            id="beta-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby="beta-invite-help"
            className="border-strong bg-canvas rounded-control focus:border-accent mt-2 min-h-11 w-full border px-4 py-3 text-base transition-colors"
            placeholder="name@example.com"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="cta-gradient text-accent-contrast min-h-11 shrink-0 rounded-full px-6 py-3 text-sm font-semibold transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-65 motion-reduce:transform-none"
        >
          {pending ? "Addingâ€¦" : "Add to beta"}
        </button>
      </div>
      <p id="beta-invite-help" className="text-muted mt-2 text-sm">
        This adds access immediately and silently. It doesn’t send an email.
      </p>
      <AnimatePresence mode="wait" initial={false}>
        {state.status !== "idle" && (
          <motion.div
            key={`${state.status}-${state.message}`}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            role={state.status === "success" ? "status" : "alert"}
            aria-live={state.status === "success" ? "polite" : undefined}
            className={`rounded-control mt-4 border px-4 py-3 text-sm ${
              state.status === "success"
                ? "border-accent-2/50 bg-surface-soft text-ink"
                : "border-danger/50 bg-surface-soft text-danger"
            }`}
          >
            {state.message}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
