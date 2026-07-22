import { describeChallengeConstraintsV1 } from "./constraint-v1";

/**
 * Constraints are the point of a challenge, so they get the page's most
 * deliberate treatment: a gradient numeral against glass, two to a row, rather
 * than a stack of grey strips. The numbering is real — these are the ordered
 * rules of a versioned constraint set, not decoration.
 */
export function ChallengeRules({ constraints }: { constraints: unknown }) {
  let rules: string[] = [];
  try {
    rules = describeChallengeConstraintsV1(constraints);
  } catch {
    rules = [];
  }

  if (!rules.length)
    return (
      <section aria-labelledby="challenge-rules-heading">
        <h2
          id="challenge-rules-heading"
          className="text-muted px-1 font-mono text-[10.5px] tracking-[0.2em] uppercase"
        >
          The creative boundaries
        </h2>
        <p className="border-strong rounded-card text-muted mt-3 border border-dashed p-6 text-center">
          This session sets no extra constraints — bring whatever the prompt
          asks for.
        </p>
      </section>
    );

  return (
    <section aria-labelledby="challenge-rules-heading">
      <h2
        id="challenge-rules-heading"
        className="text-muted px-1 font-mono text-[10.5px] tracking-[0.2em] uppercase"
      >
        The creative boundaries
      </h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2">
        {rules.map((rule, index) => (
          <li
            key={rule}
            className="dash-card rounded-card flex items-start gap-4 p-4 sm:p-5"
          >
            <span
              aria-hidden="true"
              className="from-accent to-accent-2 bg-linear-to-r bg-clip-text font-mono text-2xl leading-[1.15] font-bold tracking-[-0.04em] text-transparent tabular-nums"
            >
              {index + 1}
            </span>
            <span className="text-ink text-[15px] leading-relaxed font-medium">
              {rule}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
