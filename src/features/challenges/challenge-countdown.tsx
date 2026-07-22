import type { ChallengePhase } from "./lifecycle";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type CountdownTarget = {
  /** What the remaining time is counting down to. */
  label: string;
  at: string;
  urgent: boolean;
};

/**
 * The one deadline that matters right now. A challenge has five frozen dates,
 * but at any moment only one of them answers "how long have I got?" — showing
 * all five is what made the old schedule block read as a wall.
 */
export function nextChallengeMilestone(
  challenge: {
    phase: ChallengePhase;
    opensAt: string;
    submissionsCloseAt: string;
    votingOpensAt: string;
    votingClosesAt: string;
    resultsExpectedAt: string;
  },
  now = Date.now(),
): CountdownTarget | null {
  switch (challenge.phase) {
    case "scheduled":
      return { label: "Opens in", at: challenge.opensAt, urgent: false };
    case "open":
      return {
        label: "Submissions close in",
        at: challenge.submissionsCloseAt,
        urgent: true,
      };
    case "voting":
      return now < new Date(challenge.votingOpensAt).getTime()
        ? {
            label: "Voting opens in",
            at: challenge.votingOpensAt,
            urgent: false,
          }
        : {
            label: "Voting closes in",
            at: challenge.votingClosesAt,
            urgent: true,
          };
    default:
      return null;
  }
}

/**
 * Whole units only, largest that still reads as a real quantity. "1.7 days" is
 * a number a person has to convert; "41 hours" is one they can feel.
 */
export function formatRemaining(target: string, now = Date.now()) {
  const remaining = new Date(target).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  if (remaining >= 2 * DAY) return remainingUnit(remaining, DAY, "day");
  if (remaining >= HOUR) return remainingUnit(remaining, HOUR, "hour");
  return remainingUnit(remaining, 60 * 1000, "minute");
}

function remainingUnit(remaining: number, size: number, noun: string) {
  const value = Math.max(Math.floor(remaining / size), 1);
  return { value, unit: `${noun}${value === 1 ? "" : "s"}` };
}

/**
 * Two units of prose, for sentences rather than the countdown numeral: "3 days
 * and 4 hours". The second unit is dropped when it is zero so nothing reads
 * "2 days and 0 hours".
 */
export function formatRemainingLong(target: string, now = Date.now()) {
  const remaining = new Date(target).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const days = Math.floor(remaining / DAY);
  const hours = Math.floor((remaining % DAY) / HOUR);
  const minutes = Math.floor((remaining % HOUR) / (60 * 1000));
  const parts = days
    ? [plural(days, "day"), plural(hours, "hour")]
    : hours
      ? [plural(hours, "hour"), plural(minutes, "minute")]
      : [plural(Math.max(minutes, 1), "minute")];
  return parts.filter(Boolean).join(" and ");
}

function plural(value: number, noun: string) {
  return value ? `${value} ${noun}${value === 1 ? "" : "s"}` : "";
}

function formatExact(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ChallengeCountdown({
  target,
  closedLabel,
}: {
  target: CountdownTarget | null;
  closedLabel: string;
}) {
  const remaining = target ? formatRemaining(target.at) : null;

  if (!target || !remaining)
    return (
      <div className="border-subtle bg-surface-soft/60 rounded-card border px-5 py-4">
        <p className="text-muted font-mono text-[10.5px] tracking-[0.2em] uppercase">
          Status
        </p>
        <p className="text-ink mt-1.5 text-xl font-bold tracking-[-0.02em]">
          {closedLabel}
        </p>
      </div>
    );

  return (
    <div
      className={`rounded-card border px-5 py-4 ${target.urgent ? "border-accent/40 bg-accent/8" : "border-subtle bg-surface-soft/60"}`}
    >
      <p
        className={`font-mono text-[10.5px] tracking-[0.2em] uppercase ${target.urgent ? "text-accent" : "text-muted"}`}
      >
        {target.label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-2">
        <span className="from-accent to-accent-2 bg-linear-to-r bg-clip-text text-4xl leading-[1.05] font-bold tracking-[-0.04em] text-transparent tabular-nums">
          {remaining.value}
        </span>
        <span className="text-ink text-lg font-semibold">{remaining.unit}</span>
      </p>
      <p className="text-muted mt-1.5 font-mono text-[11px]">
        <time dateTime={target.at}>{formatExact(target.at)}</time>
      </p>
    </div>
  );
}
