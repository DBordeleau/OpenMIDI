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
      className="dash-card dash-card-action rounded-card group relative block p-5"
    >
      <p className="text-accent font-mono text-[10.5px] tracking-[0.2em] uppercase">
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-2">
        <span
          className={`text-3xl leading-none font-bold tracking-[-0.04em] tabular-nums ${figure}`}
        >
          {value.count}
          {value.hasMore ? "+" : ""}
        </span>
        <span className="text-muted text-sm">{unit}</span>
      </p>
      <span className="text-muted group-hover:text-accent mt-3 flex items-center gap-1.5 text-sm font-semibold transition-colors">
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
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
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
