import Link from "next/link";
import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { MIDI_V3_PPQ } from "@/features/midi/domain-v3";
import { MidiLibraryPreview } from "./midi-library-preview.client";
import { MidiLibraryReuseControls } from "./reuse-controls.client";
import {
  MIDI_LIBRARY_RIGHTS_BADGES,
  MIDI_LIBRARY_RIGHTS_LABELS,
} from "./rights";
import type { SavedMidiPattern } from "./types";

/** Anything other than `active` changes what the source can still do for you. */
const AVAILABILITY_NOTE: Record<
  Exclude<SavedMidiPattern["sourceAvailability"], "active">,
  string
> = {
  unlisted: "The creator unlisted the source. Your saved version still plays.",
  moderation_hidden:
    "The source listing is hidden pending moderation. Your saved version still plays.",
  unavailable:
    "The source listing is no longer available. Your saved version still plays.",
};

function Chip({
  children,
  title,
  tone = "muted",
}: {
  children: React.ReactNode;
  title?: string;
  tone?: "muted" | "warn";
}) {
  return (
    <span
      title={title}
      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-widest uppercase ${tone === "warn" ? "border-accent-2/50 bg-accent-2/10 text-accent-2" : "border-subtle text-muted"}`}
    >
      {children}
    </span>
  );
}

/**
 * A saved clip is a bookmark on an exact immutable version, not a copy — so the
 * card leads with what it sounds like and what you may do with it, and keeps the
 * version identity as a labelled chip rather than a wall of UUID. The long-form
 * attribution lives on the listing page.
 */
export function SavedClipCard({
  pattern,
  workspaces,
}: {
  pattern: SavedMidiPattern;
  workspaces: Parameters<typeof MidiLibraryReuseControls>[0]["workspaces"];
}) {
  const beats = Math.max(Math.round(pattern.durationTicks / MIDI_V3_PPQ), 1);
  const availabilityNote =
    pattern.sourceAvailability === "active"
      ? null
      : AVAILABILITY_NOTE[pattern.sourceAvailability];

  return (
    <article className="dash-card dash-card-action rounded-card group relative flex w-full flex-col p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          title={MIDI_LIBRARY_RIGHTS_LABELS[pattern.reuseMode]}
          className="border-accent-2/50 bg-accent-2/10 text-accent-2 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-widest uppercase"
        >
          {MIDI_LIBRARY_RIGHTS_BADGES[pattern.reuseMode]}
        </span>
        <span className="text-accent ml-auto font-mono text-[10.5px] tracking-widest uppercase">
          {pattern.categoryName}
        </span>
      </div>

      <h3 className="mt-3 text-xl font-bold tracking-[-0.02em] text-balance">
        <IntentPrefetchLink
          className="group-hover:text-accent transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
          href={`/library/${pattern.sourceListingId}`}
        >
          {pattern.title}
        </IntentPrefetchLink>
      </h3>
      <p className="text-muted mt-1 text-sm">
        by{" "}
        <Link
          prefetch={false}
          className="hover:text-accent relative z-10 underline transition-colors"
          href={`/@${pattern.creatorUsername}`}
        >
          @{pattern.creatorUsername}
        </Link>{" "}
        · {pattern.preset.name}
      </p>

      <div className="relative z-10">
        <MidiLibraryPreview
          listingId={pattern.sourceListingId}
          patternVersionId={pattern.midiPatternVersionId}
          title={pattern.title}
          presetId={pattern.preset.id}
          presetVersion={pattern.preset.version}
          durationTicks={pattern.durationTicks}
          notes={pattern.notes}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip>{beats} beats</Chip>
        <Chip>{pattern.noteCount} notes</Chip>
        <Chip title={`Pattern version ${pattern.midiPatternVersionId}`}>
          Exact version
        </Chip>
        <Chip>
          Saved{" "}
          <time dateTime={pattern.savedAt}>
            {new Date(pattern.savedAt).toLocaleDateString()}
          </time>
        </Chip>
      </div>

      {availabilityNote && (
        <p className="text-accent-2 mt-3 text-sm">{availabilityNote}</p>
      )}

      <div className="mt-auto">
        <div className="relative z-10">
          <MidiLibraryReuseControls
            listingId={pattern.sourceListingId}
            patternVersionId={pattern.midiPatternVersionId}
            title={pattern.title}
            saved
            canReuse={pattern.canReuse}
            workspaces={workspaces}
            compact
          />
        </div>
      </div>
    </article>
  );
}
