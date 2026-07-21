import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { ButtonLink } from "@/components/ui/button";
import { MIDI_V3_PPQ } from "@/features/midi/domain-v3";
import { formatMusicalKeyShort } from "@/features/projects/musical-key";
import type { DashboardData } from "./types";

type Resume = NonNullable<DashboardData["resume"]>;

/**
 * Lane colours cycle by track order so the miniature reads as an arrangement
 * rather than one undifferentiated block. These are the same three accents the
 * arranger uses.
 */
const LANE_TINTS = [
  "from-accent to-accent-strong",
  "from-accent-2 to-accent",
  "from-berry to-accent-2",
] as const;

function Chip({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`border-subtle text-muted rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-widest uppercase ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * A read-only miniature of the arrangement, drawn from the workspace manifest.
 * Clips are labelled with the pattern they place and lanes with their track
 * name — not a drawn piano roll, because the payload carries no note data and a
 * roll invented from nothing would be decoration pretending to be information.
 * Every block is a door: it deep-links into the editor on that exact clip.
 */
function ArrangementPreview({ resume }: { resume: Resume }) {
  const span = Math.max(resume.durationTicks, 1);
  const tracks = resume.tracks.slice(0, 6);

  if (!tracks.length)
    return (
      <p className="border-subtle rounded-control text-muted border border-dashed p-6 text-center text-sm">
        No tracks yet. Open the studio to lay down the first one.
      </p>
    );

  return (
    <div className="border-subtle rounded-control bg-surface-soft/80 grid gap-1.5 border p-2 sm:p-2.5">
      {tracks.map((track, index) => (
        <div
          key={track.trackId}
          className="grid grid-cols-[minmax(0,3.75rem)_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)]"
        >
          <span
            className="text-muted truncate font-mono text-[10px] tracking-[0.08em] uppercase"
            title={track.name}
          >
            {track.name}
          </span>
          <span className="relative block h-5 overflow-hidden rounded-md bg-white/3 sm:h-6">
            {track.clips.map((clip) => (
              <IntentPrefetchLink
                key={clip.clipId}
                href={`/studio/${resume.projectId}?editClip=${clip.clipId}`}
                title={clip.patternName ?? undefined}
                aria-label={`Edit ${clip.patternName ?? "clip"} on ${track.name}`}
                className={`absolute inset-y-0.5 flex items-center overflow-hidden rounded-sm bg-linear-to-r px-1.5 ${LANE_TINTS[index % LANE_TINTS.length]} text-accent-contrast outline-1 outline-transparent transition-[filter,outline-color] hover:outline-current hover:brightness-110 focus-visible:brightness-110`}
                style={{
                  left: `${(clip.startTick / span) * 100}%`,
                  width: `${Math.max((clip.durationTicks / span) * 100, 4)}%`,
                }}
              >
                <span className="truncate text-[10px] font-semibold">
                  {clip.patternName ?? "Clip"}
                </span>
              </IntentPrefetchLink>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ResumeBand({ resume }: { resume: DashboardData["resume"] }) {
  if (!resume)
    return (
      <section
        className="dash-card dash-card-lit rounded-card relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
        aria-labelledby="resume-heading"
      >
        <div>
          <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
            Nothing open yet
          </p>
          <h1 id="resume-heading" className="mt-2 text-3xl font-bold">
            Start something
          </h1>
          <p className="text-muted mt-2 max-w-md">
            Your most recent arrangement will wait for you here, one press from
            the studio.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/studio" prefetch={false}>
            Open the studio
          </ButtonLink>
          <ButtonLink href="/projects/new" variant="secondary" prefetch={false}>
            New project
          </ButtonLink>
        </div>
      </section>
    );

  const bars = Math.max(
    Math.round(
      resume.durationTicks / (MIDI_V3_PPQ * resume.timeSignatureNumerator),
    ),
    1,
  );
  const title = resume.contributionTitle ?? resume.projectTitle;
  const studioHref = resume.contributionId
    ? `/projects/${resume.projectId}/contributions/${resume.contributionId}`
    : `/studio/${resume.projectId}`;

  return (
    <section
      className="dash-card dash-card-lit rounded-card relative grid gap-4 p-4 sm:gap-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-center"
      aria-labelledby="resume-heading"
    >
      <div>
        <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
          Pick up where you left off
        </p>
        <h1
          id="resume-heading"
          className="mt-2 text-2xl font-bold tracking-[-0.035em] sm:text-4xl"
        >
          {title}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
          {resume.contributionId && <Chip>Contribution</Chip>}
          <Chip>{resume.tracks.length} tracks</Chip>
          <Chip className="hidden sm:inline">{bars} bars</Chip>
          <Chip>{Math.round(resume.tempoBpm)} BPM</Chip>
          <Chip className="hidden sm:inline">
            {resume.timeSignatureNumerator}/{resume.timeSignatureDenominator}
          </Chip>
          {resume.musicalKey && (
            <Chip>{formatMusicalKeyShort(resume.musicalKey)}</Chip>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
          <ButtonLink href={studioHref} prefetch={false}>
            Resume in studio
          </ButtonLink>
          <ButtonLink
            href={`/projects/${resume.projectId}`}
            variant="secondary"
            prefetch={false}
          >
            Project page
          </ButtonLink>
        </div>
      </div>

      <div>
        <div className="text-muted mb-2 flex items-center justify-between px-1 font-mono text-[10px] tracking-[0.18em] uppercase">
          <span>Your arrangement</span>
          <span aria-hidden="true">Tap a clip to edit</span>
        </div>
        <ArrangementPreview resume={resume} />
      </div>
    </section>
  );
}
