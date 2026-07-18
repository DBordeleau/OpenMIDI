import { describeChallengeConstraintsV1 } from "./constraint-v1";

export function ChallengeRules({ constraints }: { constraints: unknown }) {
  const rules = describeChallengeConstraintsV1(constraints);
  return (
    <section aria-labelledby="challenge-rules-heading">
      <h2 id="challenge-rules-heading" className="text-2xl font-bold">
        The creative boundaries
      </h2>
      <ol className="mt-4 space-y-3">
        {rules.map((rule, index) => (
          <li
            key={rule}
            className="border-subtle bg-surface-soft rounded-control flex gap-3 border p-4"
          >
            <span className="text-accent-2 font-mono" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{rule}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
