"use client";

import { useState } from "react";
import { confirmAssetCredits } from "./actions";

type Role = "creator" | "performer" | "producer" | "engineer" | "other";
type Row = {
  id: string;
  kind: "self" | "external";
  role: Role;
  creditName: string;
};
const roles: Role[] = ["creator", "performer", "producer", "engineer", "other"];

export function CreditConfirmationForm({
  assetId,
  suggestedName,
}: {
  assetId: string;
  suggestedName: string;
}) {
  const [rows, setRows] = useState<Row[]>([
    {
      id: "initial-self-credit",
      kind: "self",
      role: "creator",
      creditName: suggestedName,
    },
  ]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  function update(id: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }
  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= rows.length) return;
    setRows((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }
  async function submit() {
    setPending(true);
    setMessage("");
    const result = await confirmAssetCredits({
      assetId,
      requestId: crypto.randomUUID(),
      credits: rows.map((row) =>
        row.kind === "self"
          ? { kind: "self" as const, role: row.role }
          : {
              kind: "external" as const,
              role: row.role,
              creditName: row.creditName,
            },
      ),
    });
    setPending(false);
    setMessage(result.error ?? "Credits confirmed.");
  }

  return (
    <section
      className="border-accent mt-4 rounded-lg border p-4"
      aria-labelledby={`credits-${assetId}`}
    >
      <h3 className="font-semibold" id={`credits-${assetId}`}>
        Credits required
      </h3>
      <p className="mt-1 text-sm text-zinc-300">
        The uploader credit is a suggestion. Confirm the real ordered credits
        before using this source. Confirmed credits cannot be edited.
      </p>
      <ol className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <li className="rounded-lg border border-white/10 p-3" key={row.id}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="block text-sm">Person</span>
                <select
                  className="mt-1 min-h-11 w-full rounded-lg border bg-black px-3"
                  value={row.kind}
                  onChange={(event) =>
                    update(row.id, { kind: event.target.value as Row["kind"] })
                  }
                >
                  <option value="self">Me ({suggestedName})</option>
                  <option value="external">External credit</option>
                </select>
              </label>
              <label>
                <span className="block text-sm">Role</span>
                <select
                  className="mt-1 min-h-11 w-full rounded-lg border bg-black px-3 capitalize"
                  value={row.role}
                  onChange={(event) =>
                    update(row.id, { role: event.target.value as Role })
                  }
                >
                  {roles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
            </div>
            {row.kind === "external" && (
              <label className="mt-3 block">
                <span className="block text-sm">Credit name</span>
                <input
                  className="mt-1 min-h-11 w-full rounded-lg border bg-black px-3"
                  maxLength={120}
                  required
                  value={row.creditName}
                  onChange={(event) =>
                    update(row.id, { creditName: event.target.value })
                  }
                />
              </label>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="min-h-11 rounded-lg border px-3"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                type="button"
              >
                Move up
              </button>
              <button
                className="min-h-11 rounded-lg border px-3"
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
                type="button"
              >
                Move down
              </button>
              <button
                className="min-h-11 rounded-lg border px-3"
                disabled={rows.length === 1}
                onClick={() =>
                  setRows((current) =>
                    current.filter(({ id }) => id !== row.id),
                  )
                }
                type="button"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="min-h-11 rounded-lg border px-4"
          disabled={rows.length >= 12}
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                kind: "external",
                role: "performer",
                creditName: "",
              },
            ])
          }
          type="button"
        >
          Add credit
        </button>
        <button
          className="bg-accent min-h-11 rounded-lg px-4 font-semibold text-slate-950"
          disabled={pending}
          onClick={() => void submit()}
          type="button"
        >
          {pending ? "Confirming…" : "Confirm credits"}
        </button>
      </div>
      <p className="mt-3 text-sm" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
