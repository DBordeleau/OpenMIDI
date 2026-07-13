"use client";

import { useState } from "react";
import { withdrawContributionAction } from "./actions";
import type { ContributionStatus } from "./types";

export function WithdrawContributionForm({
  projectId,
  contributionId,
  status,
  currentVersionId,
}: {
  projectId: string;
  contributionId: string;
  status: ContributionStatus;
  currentVersionId: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <section className="rounded-card border-subtle mt-8 border p-6">
      <h2 className="text-xl font-bold">Withdraw contribution</h2>
      <p className="text-muted mt-2">
        Withdrawal archives the editable workspace. Immutable submitted versions
        remain retained and visible to authorized participants.
      </p>
      {message && (
        <p role="alert" className="mt-3 text-red-700">
          {message}
        </p>
      )}
      <button
        className="rounded-control border-strong mt-5 min-h-11 border px-5 font-semibold disabled:opacity-50"
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!confirm("Withdraw this contribution and archive its workspace?"))
            return;
          setPending(true);
          const result = await withdrawContributionAction(projectId, {
            contributionId,
            expectedStatus: status,
            expectedCurrentVersionId: currentVersionId,
          });
          if (!result.ok) {
            setMessage("The contribution changed. Reload before withdrawing.");
            setPending(false);
            return;
          }
          location.reload();
        }}
      >
        {pending ? "Withdrawingâ€¦" : "Withdraw contribution"}
      </button>
    </section>
  );
}
