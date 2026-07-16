"use client";

import { useActionState, useState } from "react";
import { contentHoldAction, type FormState } from "./actions";

export function HoldForm({
  targetKind,
  targetId,
  holds,
}: {
  targetKind: "profile" | "project" | "contribution";
  targetId: string;
  holds: Array<{ id: string; type: "legal" | "abuse"; placedAt: string }>;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [releaseRequestIds] = useState(() =>
    Object.fromEntries(holds.map((hold) => [hold.id, crypto.randomUUID()])),
  );
  const [state, action, pending] = useActionState<FormState, FormData>(
    contentHoldAction,
    {},
  );
  return (
    <section className="border-subtle mt-8 border-t pt-6">
      <h2 className="text-xl font-bold">Retention holds</h2>
      {holds.length > 0 && (
        <ul className="mt-3 space-y-2">
          {holds.map((hold) => (
            <li
              className="rounded-control border-subtle border p-3"
              key={hold.id}
            >
              <span className="font-semibold capitalize">{hold.type} hold</span>{" "}
              <span className="text-muted text-sm">
                since {new Date(hold.placedAt).toLocaleString()}
              </span>
              <form action={action} className="mt-3 flex flex-wrap gap-2">
                <input
                  type="hidden"
                  name="requestId"
                  value={releaseRequestIds[hold.id]}
                />
                <input type="hidden" name="operation" value="release" />
                <input type="hidden" name="holdId" value={hold.id} />
                <input
                  name="reason"
                  required
                  maxLength={500}
                  placeholder="Release reason"
                  className="border-strong bg-canvas rounded-control min-h-11 flex-1 border px-3"
                />
                <button
                  className="border-strong rounded-full border px-4 font-semibold"
                  disabled={pending}
                >
                  Release
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="operation" value="place" />
        <input type="hidden" name="targetKind" value={targetKind} />
        <input type="hidden" name="targetId" value={targetId} />
        <select
          name="holdType"
          className="border-strong bg-canvas rounded-control min-h-11 border px-3"
          defaultValue="abuse"
        >
          <option value="abuse">Abuse hold</option>
          <option value="legal">Legal hold</option>
        </select>
        <textarea
          name="reason"
          required
          maxLength={500}
          placeholder="Why retention must pause"
          className="border-strong bg-canvas rounded-control block min-h-24 w-full border p-3"
        />
        <button
          className="border-strong rounded-full border px-5 py-3 font-semibold"
          disabled={pending}
        >
          Place hold
        </button>
      </form>
      {state.message && (
        <p role="status" className="mt-3">
          {state.message}
        </p>
      )}
    </section>
  );
}
