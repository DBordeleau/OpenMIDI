import { FiArrowRight } from "react-icons/fi";
import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import type { DashboardBoundedCount, DashboardData } from "./types";

type Tone = "accent" | "warn" | "quiet";

function Tile({
  label,
  value,
  unit,
  action,
  href,
  tone,
}: {
  label: string;
  value: DashboardBoundedCount;
  unit: string;
  action: string;
  href: string;
  tone: Tone;
}) {
  // A zero is a state, not a broken stat: it drops the gradient and reads muted
  // so "nothing to do here" registers at a glance.
  const resolved: Tone = value.count === 0 ? "quiet" : tone;
  const figure =
    resolved === "accent"
      ? "cta-gradient bg-clip-text text-transparent"
      : resolved === "warn"
        ? "text-accent-2"
        : "text-muted";

  return (
    <IntentPrefetchLink
      href={href}
      className="dash-card dash-card-action rounded-card group relative block p-3.5 sm:p-5"
    >
      <p className="text-accent font-mono text-[10.5px] tracking-[0.2em] uppercase">
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-2 sm:mt-2">
        <span
          className={`text-2xl leading-none font-bold tracking-[-0.04em] tabular-nums sm:text-3xl ${figure}`}
        >
          {value.count}
          {value.hasMore ? "+" : ""}
        </span>
        <span className="text-muted text-sm">{unit}</span>
      </p>
      {/* The whole tile is the link, so on a phone this row is redundant chrome
          — but it is the only thing naming the destination, so it stays in the
          accessibility tree rather than being display:none. */}
      <span className="text-muted group-hover:text-accent sr-only text-sm font-semibold transition-colors sm:not-sr-only sm:mt-3 sm:flex sm:items-center sm:gap-1.5">
        {action}
        <FiArrowRight
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </IntentPrefetchLink>
  );
}

/**
 * Four states worth acting on, each one press from its destination. These are
 * deliberately not duplicates of the section headers below — "saved from
 * library" is other people's clips you bookmarked, which is a different
 * destination than your own.
 */
export function StateRail({
  review,
  counts,
}: {
  review: DashboardData["review"];
  counts: DashboardData["counts"];
}) {
  return (
    <nav
      aria-label="Needs your attention"
      // Two columns from the smallest screen up. Left at one column, four
      // numbers cost roughly half a phone screen.
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"
    >
      <Tile
        label="Needs review"
        value={review}
        unit="submitted"
        action="Open review queue"
        href="/projects?scope=owned&review=1"
        tone="accent"
      />
      <Tile
        label="Contributions"
        value={counts.pendingContributions}
        unit="in flight"
        action="View contributions"
        href="/contributions"
        tone="accent"
      />
      <Tile
        label="Saved from library"
        value={counts.savedClips}
        unit="clips"
        action="Open saved clips"
        href="/library/saved"
        tone="accent"
      />
      <Tile
        label="Archiving soon"
        value={counts.archivingSoon}
        unit="workspaces"
        action="Save one to keep it"
        href="/projects"
        tone="warn"
      />
    </nav>
  );
}
