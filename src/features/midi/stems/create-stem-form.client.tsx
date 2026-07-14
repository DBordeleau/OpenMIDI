"use client";

import { useActionState } from "react";
import type { CreateMidiStemState } from "./actions";

export function CreateMidiStemForm({
  action,
  requestId,
  entryMode,
  parentStemVersionId,
}: {
  action: (
    state: CreateMidiStemState,
    formData: FormData,
  ) => Promise<CreateMidiStemState>;
  requestId: string;
  entryMode: "blank" | "import" | "derive";
  parentStemVersionId: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="mt-8 space-y-6">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="entryMode" value={entryMode} />
      <input
        type="hidden"
        name="parentStemVersionId"
        value={parentStemVersionId ?? ""}
      />
      {state.message && (
        <p
          role="alert"
          className="border-danger text-danger rounded-control border p-3"
        >
          {state.message}
        </p>
      )}
      <label className="block font-semibold">
        Stem name
        <input
          autoFocus
          required
          name="name"
          maxLength={120}
          placeholder="Night chords"
          className="focus:border-accent border-strong bg-surface rounded-control mt-2 min-h-11 w-full border px-3 py-2 transition-colors"
        />
      </label>
      <button
        disabled={pending}
        className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition-transform hover:-translate-y-px disabled:opacity-60"
      >
        {pending ? "Preparing draft…" : "Open MIDI editor"}
      </button>
    </form>
  );
}
