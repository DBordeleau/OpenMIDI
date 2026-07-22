import Link from "next/link";
import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { MidiLibraryPreview } from "./midi-library-preview.client";
import { MidiLibraryReuseControls } from "./reuse-controls.client";
import {
  formatPitch,
  MIDI_LIBRARY_RIGHTS_BADGES,
  MIDI_LIBRARY_RIGHTS_LABELS,
} from "./rights";
import type { MidiLibraryListing } from "./types";

function formatBeats(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-subtle text-muted rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-widest uppercase">
      {children}
    </span>
  );
}

/**
 * A browsing card: identity, what you may do with it, what it sounds like, and
 * the numbers that decide whether it fits — in that order. The long-form
 * credits and rights prose live on the listing page; a grid meant for scanning
 * cannot carry them.
 */
export function ListingCard({
  listing,
  viewerSignedIn,
  saved,
  workspaces,
}: {
  listing: MidiLibraryListing;
  viewerSignedIn: boolean;
  saved: boolean;
  workspaces: Parameters<typeof MidiLibraryReuseControls>[0]["workspaces"];
}) {
  const reusable = listing.reuseMode === "commercial_reuse";

  return (
    <article className="dash-card dash-card-action rounded-card group relative flex w-full flex-col p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          title={MIDI_LIBRARY_RIGHTS_LABELS[listing.reuseMode]}
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-widest uppercase ${reusable ? "border-accent-2/50 bg-accent-2/10 text-accent-2" : "border-subtle text-muted"}`}
        >
          {MIDI_LIBRARY_RIGHTS_BADGES[listing.reuseMode]}
        </span>
        <span className="text-accent ml-auto font-mono text-[10.5px] tracking-widest uppercase">
          {listing.category.name}
        </span>
      </div>

      <h3 className="mt-3 text-xl font-bold tracking-[-0.02em] text-balance">
        <IntentPrefetchLink
          className="group-hover:text-accent transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
          href={`/library/${listing.listingId}`}
        >
          {listing.title}
        </IntentPrefetchLink>
      </h3>
      <p className="text-muted mt-1 text-sm">
        by{" "}
        <Link
          prefetch={false}
          className="hover:text-accent relative z-10 underline transition-colors"
          href={`/@${listing.creatorUsername}`}
        >
          @{listing.creatorUsername}
        </Link>{" "}
        · {listing.preset.name}
      </p>

      <div className="relative z-10">
        <MidiLibraryPreview
          listingId={listing.listingId}
          patternVersionId={listing.midiPatternVersionId}
          title={listing.title}
          presetId={listing.preset.id}
          presetVersion={listing.preset.version}
          durationTicks={listing.durationTicks}
          notes={listing.notes}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip>{formatBeats(listing.durationBeats)} beats</Chip>
        <Chip>{listing.noteCount} notes</Chip>
        <Chip>
          {formatPitch(listing.minPitch)}–{formatPitch(listing.maxPitch)}
        </Chip>
        {/* Abbreviated on a phone so the metric row stays one line — the
            information is kept, not dropped. */}
        <Chip>
          <span className="sm:hidden">
            {listing.polyphony === "monophonic" ? "mono" : "poly"}
          </span>
          <span className="hidden sm:inline">{listing.polyphony}</span>
        </Chip>
      </div>

      {listing.description && (
        <p className="text-muted mt-3 line-clamp-2 text-sm">
          {listing.description}
        </p>
      )}

      <div className="mt-auto">
        {reusable && viewerSignedIn ? (
          <div className="relative z-10">
            <MidiLibraryReuseControls
              listingId={listing.listingId}
              patternVersionId={listing.midiPatternVersionId}
              title={listing.title}
              saved={saved}
              canReuse
              workspaces={workspaces}
              compact
            />
          </div>
        ) : reusable ? (
          <p className="border-subtle text-muted mt-4 border-t pt-3 text-sm">
            <Link
              prefetch={false}
              className="text-accent relative z-10 underline"
              href={`/sign-in?next=${encodeURIComponent(`/library/${listing.listingId}`)}`}
            >
              Sign in
            </Link>{" "}
            to save, import, fork, edit, or export this CC BY version.
          </p>
        ) : (
          <p className="border-subtle text-muted mt-4 border-t pt-3 text-sm">
            Listen and inspect freely — saving, importing, forking and exporting
            are not granted.
          </p>
        )}
      </div>
    </article>
  );
}
