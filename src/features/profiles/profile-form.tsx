"use client";

import { useActionState } from "react";
import { saveProfileAction, type ProfileFormState } from "./actions";

const fieldClass =
  "rounded-control border-strong bg-surface mt-2 min-h-11 w-full border px-3 py-2 text-ink";

export function ProfileForm({
  profile,
}: {
  profile: {
    username: string | null;
    displayName: string | null;
    creditName: string | null;
    bio: string | null;
  };
}) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(
    saveProfileAction,
    {},
  );
  return (
    <form
      action={action}
      className="mt-8 space-y-6"
      aria-describedby={state.message ? "form-error" : undefined}
    >
      {state.message && (
        <p
          id="form-error"
          role="alert"
          className="text-danger rounded-control border border-current p-3"
        >
          {state.message}
        </p>
      )}
      <label className="block">
        <span className="font-semibold">Username</span>
        <span className="text-muted ml-2 text-sm">
          Public handle; permanent after saving
        </span>
        <div className="flex items-center">
          <span aria-hidden="true" className="text-muted mt-2 mr-2">
            @
          </span>
          <input
            className={fieldClass}
            name="username"
            defaultValue={profile.username ?? ""}
            readOnly={Boolean(profile.username)}
            autoComplete="username"
            aria-invalid={Boolean(state.fields?.username)}
          />
        </div>
        {state.fields?.username?.map((error) => (
          <span className="text-danger mt-1 block text-sm" key={error}>
            {error}
          </span>
        ))}
      </label>
      <label className="block">
        <span className="font-semibold">Display name</span>
        <input
          className={fieldClass}
          name="displayName"
          defaultValue={profile.displayName ?? ""}
          maxLength={80}
          autoComplete="name"
        />
      </label>
      <label className="block">
        <span className="font-semibold">Credit name</span>
        <span className="text-muted ml-2 text-sm">
          How music credits should identify you
        </span>
        <input
          className={fieldClass}
          name="creditName"
          defaultValue={profile.creditName ?? ""}
          maxLength={120}
        />
      </label>
      <label className="block">
        <span className="font-semibold">Bio</span>
        <textarea
          className={`${fieldClass} min-h-32`}
          name="bio"
          defaultValue={profile.bio ?? ""}
          maxLength={500}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-control bg-accent min-h-11 px-5 font-semibold text-slate-950 disabled:opacity-60"
      >
        {pending
          ? "Saving…"
          : profile.username
            ? "Save profile"
            : "Complete profile"}
      </button>
    </form>
  );
}
