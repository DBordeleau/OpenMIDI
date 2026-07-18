import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { requireViewer } from "@/features/auth/guards";
import { MidiLibraryPreview } from "@/features/midi-library/midi-library-preview.client";
import { MidiLibraryReuseControls } from "@/features/midi-library/reuse-controls.client";
import {
  listOwnedPrivateMidiWorkspaces,
  listSavedMidiLibraryPatterns,
} from "@/server/repositories/midi-library";

export const metadata: Metadata = {
  title: "Saved clips",
  description:
    "Your private exact-version MIDI pattern bookmarks and reuse tools.",
};

export default async function SavedMidiPatternsPage() {
  await requireViewer("/library/saved");
  const [patterns, workspaces] = await Promise.all([
    listSavedMidiLibraryPatterns(),
    listOwnedPrivateMidiWorkspaces(),
  ]);
  return (
    <main id="main-content">
      <Container className="py-14 sm:py-20">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-accent-2 font-mono text-xs tracking-[.2em] uppercase">
              Private collection
            </p>
            <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Saved clips</h1>
            <p className="text-muted mt-4 text-lg">
              Exact immutable versions you bookmarked—no duplicated notes and no
              ownership transfer.
            </p>
          </div>
          <ButtonLink href="/library" variant="secondary">
            Explore the library
          </ButtonLink>
        </header>

        {patterns.length ? (
          <section
            className="mt-10 grid gap-6 lg:grid-cols-2"
            aria-label="Saved MIDI clips"
          >
            {patterns.map((pattern) => (
              <article
                key={pattern.midiPatternVersionId}
                className="rounded-card border-subtle bg-surface-raised border p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-accent font-mono text-[11px] tracking-[.16em] uppercase">
                      {pattern.categoryName}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">
                      <Link
                        className="hover:text-accent underline decoration-transparent hover:decoration-current"
                        href={`/library/${pattern.sourceListingId}`}
                      >
                        {pattern.title}
                      </Link>
                    </h2>
                    <p className="text-muted mt-1 text-sm">
                      by{" "}
                      <Link
                        className="underline"
                        href={`/@${pattern.creatorUsername}`}
                      >
                        @{pattern.creatorUsername}
                      </Link>{" "}
                      · {pattern.creatorCreditName}
                    </p>
                  </div>
                  <span className="border-accent-2 text-accent-2 rounded-full border px-3 py-1 text-xs font-semibold">
                    CC BY 4.0
                  </span>
                </div>
                <dl className="border-subtle mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Exact version</dt>
                    <dd className="mt-1 font-mono text-xs break-all">
                      {pattern.midiPatternVersionId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Source</dt>
                    <dd className="mt-1 capitalize">
                      {pattern.sourceAvailability.replaceAll("_", " ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Preset</dt>
                    <dd className="mt-1">
                      {pattern.preset.name} v{pattern.preset.version}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">License</dt>
                    <dd className="mt-1">
                      <a
                        className="text-accent underline"
                        href={pattern.license.url}
                      >
                        Commercial reuse · CC BY 4.0
                      </a>
                    </dd>
                  </div>
                </dl>
                {pattern.notes.length ? (
                  <MidiLibraryPreview
                    listingId={pattern.sourceListingId}
                    patternVersionId={pattern.midiPatternVersionId}
                    title={pattern.title}
                    presetId={pattern.preset.id}
                    presetVersion={pattern.preset.version}
                    durationTicks={pattern.durationTicks}
                    notes={pattern.notes}
                  />
                ) : null}
                <section
                  className="border-subtle mt-4 border-t pt-4"
                  aria-label="Attribution"
                >
                  <h3 className="font-semibold">
                    Attribution carried with reuse
                  </h3>
                  <p className="text-muted mt-1 text-sm">
                    Creator snapshot: {pattern.creatorCreditName}
                  </p>
                  {pattern.externalCredits.length ? (
                    <ul className="text-muted mt-2 space-y-1 text-sm">
                      {pattern.externalCredits.map((credit, index) => (
                        <li key={`${credit.creditedName}:${index}`}>
                          {credit.role}:{" "}
                          <span className="text-ink">
                            {credit.creditedName}
                          </span>
                          {credit.workTitle ? ` · ${credit.workTitle}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted mt-2 text-sm">
                      No separate external credits were recorded.
                    </p>
                  )}
                  <p className="text-muted mt-2 text-xs">
                    Credits acknowledge sources; they do not replace the CC BY
                    grant or prove permission.
                  </p>
                </section>
                <MidiLibraryReuseControls
                  listingId={pattern.sourceListingId}
                  patternVersionId={pattern.midiPatternVersionId}
                  title={pattern.title}
                  saved
                  canReuse={pattern.canReuse}
                  workspaces={workspaces}
                  compact
                />
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-card border-subtle mt-10 border border-dashed p-10 text-center">
            <h2 className="text-2xl font-bold">No saved clips yet.</h2>
            <p className="text-muted mt-2">
              Commercially reusable library patterns can be bookmarked here
              without copying their notes.
            </p>
            <div className="mt-5">
              <ButtonLink href="/library?rights=commercial_reuse">
                Find reusable MIDI
              </ButtonLink>
            </div>
          </section>
        )}
      </Container>
    </main>
  );
}
