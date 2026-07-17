import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { MidiLibraryPreview } from "@/features/midi-library/midi-library-preview.client";
import { MidiLibraryReadOnlyPianoRoll } from "@/features/midi-library/read-only-piano-roll";
import { MidiLibraryPatternComparisonView } from "@/features/midi-library/pattern-version-comparison.client";
import { MidiLibraryReportForm } from "@/features/midi-library/report-form.client";
import {
  MIDI_LIBRARY_RIGHTS_LABELS,
  formatInstrumentFamily,
  formatPitch,
} from "@/features/midi-library/rights";
import { libraryUuidSchema } from "@/features/midi-library/detail";
import {
  getPublicMidiLibraryListing,
  getPublicMidiLibraryPatternComparison,
} from "@/server/repositories/midi-library";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Library pattern" };

export default async function MidiLibraryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const listingId = libraryUuidSchema.safeParse((await params).listingId);
  if (!listingId.success) notFound();
  const detail = await getPublicMidiLibraryListing(listingId.data);
  if (!detail) notFound();
  const query = await searchParams;
  const first = detail.history[0];
  const last = detail.history.at(-1);
  if (!first || !last) notFound();
  const from = query.from ?? first.midiPatternVersionId;
  const to = query.to ?? last.midiPatternVersionId;
  if (
    !libraryUuidSchema.safeParse(from).success ||
    !libraryUuidSchema.safeParse(to).success
  )
    notFound();
  let comparison;
  try {
    comparison = await getPublicMidiLibraryPatternComparison({
      listingId: listingId.data,
      fromPatternVersionId: from,
      toPatternVersionId: to,
    });
  } catch {
    notFound();
  }
  if (!comparison) notFound();
  const { listing } = detail;
  return (
    <main id="main-content">
      <Container className="py-16 sm:py-20">
        <Link
          href="/library"
          className="text-muted hover:text-accent text-sm underline"
        >
          ← Back to library
        </Link>
        <article className="mt-7">
          <p className="text-accent-2 font-mono text-xs tracking-[0.18em] uppercase">
            Exact immutable library listing
          </p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
            <div>
              <h1 className="text-4xl font-bold text-balance sm:text-5xl">
                {listing.title}
              </h1>
              <p className="text-muted mt-3">
                By{" "}
                <Link
                  className="text-ink underline"
                  href={`/@${listing.creatorUsername}`}
                >
                  @{listing.creatorUsername}
                </Link>{" "}
                · {listing.creatorDisplayName}
              </p>
            </div>
            <span
              className={`rounded-full border px-4 py-2 text-sm font-bold ${listing.reuseMode === "commercial_reuse" ? "border-accent-2 text-accent-2" : "border-accent text-accent"}`}
            >
              {MIDI_LIBRARY_RIGHTS_LABELS[listing.reuseMode]}
            </span>
          </div>
          {listing.description && (
            <p className="mt-5 max-w-3xl text-lg">{listing.description}</p>
          )}

          <section
            className="rounded-card border-strong bg-surface mt-8 border p-6"
            aria-labelledby="rights-heading"
          >
            <p className="text-accent font-mono text-xs uppercase">
              Reuse and rights
            </p>
            <h2 id="rights-heading" className="mt-2 text-2xl font-bold">
              {MIDI_LIBRARY_RIGHTS_LABELS[listing.reuseMode]}
            </h2>
            <p className="text-muted mt-3">
              {listing.reuseMode === "commercial_reuse"
                ? "This exact version is offered under CC BY 4.0. Reuse must preserve attribution and the license terms."
                : "You may preview and inspect this exact version here, but OpenMIDI library actions do not grant saving, importing, copying, editing, or export."}
            </p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Rights basis</dt>
                <dd className="mt-1 capitalize">
                  {listing.rightsBasis.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Attestation</dt>
                <dd className="mt-1">
                  {listing.attestationVersion} ·{" "}
                  {new Date(listing.attestedAt).toLocaleDateString()}
                </dd>
              </div>
              {listing.supportingSourceUrl && (
                <div>
                  <dt className="text-muted">Public source</dt>
                  <dd className="mt-1">
                    <a
                      className="text-accent underline"
                      href={listing.supportingSourceUrl}
                      rel="noreferrer"
                    >
                      Open HTTPS source
                    </a>
                  </dd>
                </div>
              )}
              {listing.supportingSourceTerms && (
                <div>
                  <dt className="text-muted">Source terms</dt>
                  <dd className="mt-1">{listing.supportingSourceTerms}</dd>
                </div>
              )}
              {listing.publicDomainRationale && (
                <div className="sm:col-span-2">
                  <dt className="text-muted">Public-domain rationale</dt>
                  <dd className="mt-1">{listing.publicDomainRationale}</dd>
                </div>
              )}
            </dl>
          </section>

          <MidiLibraryPreview
            listingId={listing.listingId}
            patternVersionId={listing.midiPatternVersionId}
            title={listing.title}
            presetId={listing.preset.id}
            presetVersion={listing.preset.version}
            durationTicks={listing.durationTicks}
            notes={listing.notes}
          />

          <dl className="rounded-card border-subtle mt-6 grid gap-4 border p-5 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <dt className="text-muted">Pattern version</dt>
              <dd className="mt-1 font-semibold">
                {listing.midiPatternVersionId}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Category</dt>
              <dd className="mt-1">{listing.category.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Preset</dt>
              <dd className="mt-1">
                {listing.preset.name} v{listing.preset.version}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Family</dt>
              <dd className="mt-1">
                {formatInstrumentFamily(listing.preset.family)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Length</dt>
              <dd className="mt-1">
                {listing.durationBeats} beats · {listing.noteCount} notes
              </dd>
            </div>
            <div>
              <dt className="text-muted">Range</dt>
              <dd className="mt-1">
                {formatPitch(listing.minPitch)}–{formatPitch(listing.maxPitch)}
              </dd>
            </div>
          </dl>

          <MidiLibraryReadOnlyPianoRoll
            notes={listing.notes}
            durationTicks={listing.durationTicks}
          />

          <section className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-card border-subtle bg-surface border p-6">
              <p className="text-accent-2 font-mono text-xs uppercase">
                Verified inside OpenMIDI
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Creator and source lineage
              </h2>
              <p className="text-muted mt-3">
                OpenMIDI records this exact creator and immutable pattern/source
                relationship.
              </p>
              <dl className="mt-5 space-y-3 text-sm break-all">
                <div>
                  <dt className="text-muted">Creator credit</dt>
                  <dd>{listing.creatorCreditName}</dd>
                </div>
                <div>
                  <dt className="text-muted">Pattern ID</dt>
                  <dd>{detail.platformLineage.patternId}</dd>
                </div>
                {detail.platformLineage.sourcePatternId && (
                  <div>
                    <dt className="text-muted">Source pattern</dt>
                    <dd>{detail.platformLineage.sourcePatternId}</dd>
                  </div>
                )}
                {detail.platformLineage.sourceCreatorCreditName && (
                  <div>
                    <dt className="text-muted">Source creator</dt>
                    <dd>{detail.platformLineage.sourceCreatorCreditName}</dd>
                  </div>
                )}
                {detail.platformLineage.listedVersionParentId && (
                  <div>
                    <dt className="text-muted">Parent version</dt>
                    <dd>{detail.platformLineage.listedVersionParentId}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="rounded-card border-subtle border p-6">
              <p className="text-accent font-mono text-xs uppercase">
                Separate external acknowledgements
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Immutable external credits
              </h2>
              <p className="text-muted mt-3 text-sm">
                Credits acknowledge sources but are not proof of permission.
                They remain separate from verified OpenMIDI lineage.
              </p>
              {listing.externalCredits.length ? (
                <ul className="mt-5 space-y-4">
                  {listing.externalCredits.map((credit, index) => (
                    <li
                      key={`${credit.creditedName}:${index}`}
                      className="border-subtle border-t pt-4 first:border-0 first:pt-0"
                    >
                      <strong>{credit.creditedName}</strong>
                      <span className="text-muted block text-sm">
                        {credit.role}
                        {credit.workTitle ? ` · ${credit.workTitle}` : ""}
                      </span>
                      {credit.sourceUrl && (
                        <a
                          href={credit.sourceUrl}
                          rel="noreferrer"
                          className="text-accent mt-1 inline-block text-sm underline"
                        >
                          Source
                        </a>
                      )}
                      {credit.sourceTerms && (
                        <p className="mt-1 text-sm">{credit.sourceTerms}</p>
                      )}
                      {credit.attributionNote && (
                        <p className="text-muted mt-1 text-sm">
                          {credit.attributionNote}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted mt-5">
                  No external credits were recorded for this listing edition.
                </p>
              )}
            </div>
          </section>

          <section className="mt-10" aria-labelledby="history-heading">
            <h2 id="history-heading" className="text-2xl font-bold">
              Immutable version history
            </h2>
            <ol className="mt-4 space-y-3">
              {detail.history.map((version) => (
                <li
                  key={version.midiPatternVersionId}
                  className="rounded-control border-subtle grid gap-2 border p-4 sm:grid-cols-[8rem_1fr_auto]"
                >
                  <strong>Version {version.versionNumber}</strong>
                  <span>{version.creatorCreditName}</span>
                  <span className="text-muted text-sm">
                    {version.noteCount} notes ·{" "}
                    {new Date(version.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <MidiLibraryPatternComparisonView
            listingId={listing.listingId}
            title={listing.title}
            preset={listing.preset}
            history={detail.history}
            comparison={comparison}
          />

          <section className="mt-12" aria-labelledby="usage-heading">
            <h2 id="usage-heading" className="text-2xl font-bold">
              Public project usage
            </h2>
            <p className="text-muted mt-2">
              {detail.usage.publicProjectCount} public{" "}
              {detail.usage.publicProjectCount === 1
                ? "project uses"
                : "projects use"}{" "}
              this exact version. Private projects never affect this count or
              these links.
            </p>
            {detail.usage.projects.length ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {detail.usage.projects.map((project) => (
                  <li
                    key={project.projectId}
                    className="rounded-control border-subtle border p-4"
                  >
                    <Link
                      className="font-semibold underline"
                      href={`/projects/${project.projectId}`}
                    >
                      {project.title}
                    </Link>
                    <span className="text-muted block text-sm">
                      Revision {project.revisionNumber}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <MidiLibraryReportForm listingId={listing.listingId} />
        </article>
      </Container>
    </main>
  );
}
