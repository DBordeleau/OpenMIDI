import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal.client";
import { requireViewer } from "@/features/auth/guards";
import { resolveSynthPreset } from "@/features/midi/presets";
import {
  listMidiStemDrafts,
  listMidiStemVersions,
} from "@/server/repositories/midi-stems";

export const metadata: Metadata = { title: "My stems" };

export default async function MidiStemsPage() {
  await requireViewer("/stems");
  const [drafts, versions] = await Promise.all([
    listMidiStemDrafts(),
    listMidiStemVersions(),
  ]);
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-accent-2 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
              Reusable MIDI ideas
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              My stems
            </h1>
            <p className="text-muted mt-3 max-w-2xl text-lg">
              Shape private MIDI parts outside a project, then keep their exact
              versions ready for collaboration.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/stems/new?mode=import" variant="secondary">
              Import MIDI
            </ButtonLink>
            <ButtonLink href="/stems/new">New MIDI stem</ButtonLink>
          </div>
        </Reveal>

        {drafts.length ? (
          <Reveal
            as="section"
            className="mt-10"
            aria-labelledby="drafts-heading"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id="drafts-heading" className="text-xl font-semibold">
                Private drafts
              </h2>
              <p className="text-muted text-sm">{drafts.length} of 100</p>
            </div>
            <ul className="grid gap-4 lg:grid-cols-2">
              {drafts.map((draft) => {
                const preset = resolveSynthPreset(
                  draft.defaultPresetId,
                  draft.defaultPresetVersion,
                );
                return (
                  <li
                    key={draft.draftId}
                    className="rounded-card border-subtle bg-surface shadow-raised border p-6"
                  >
                    <p className="text-accent font-mono text-xs uppercase">
                      {draft.entryMode} draft
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold">
                      <Link
                        className="hover:text-accent"
                        href={`/stems/${draft.stemId}/edit`}
                      >
                        {draft.name}
                      </Link>
                    </h3>
                    <p className="text-muted mt-3">
                      {preset.name} · {draft.noteCount}{" "}
                      {draft.noteCount === 1 ? "note" : "notes"}
                    </p>
                    <div className="mt-6 flex items-center justify-between gap-4">
                      <time
                        className="text-muted text-sm"
                        dateTime={draft.updatedAt}
                      >
                        Updated {new Date(draft.updatedAt).toLocaleDateString()}
                      </time>
                      <ButtonLink
                        href={`/stems/${draft.stemId}/edit`}
                        variant="secondary"
                      >
                        Continue
                      </ButtonLink>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        ) : (
          <section className="rounded-card border-strong bg-surface mt-10 border border-dashed p-8 text-center sm:p-12">
            <p className="text-accent font-mono text-xs uppercase">
              Your first reusable part
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              Start with a few notes and a sound.
            </h2>
            <p className="text-muted mx-auto mt-3 max-w-xl leading-7">
              Your draft stays private while you listen, adjust, save, and
              return.
            </p>
            <div className="mt-6">
              <ButtonLink href="/stems/new">Create a MIDI stem</ButtonLink>
            </div>
          </section>
        )}

        <section className="mt-12" aria-labelledby="versions-heading">
          <h2 id="versions-heading" className="text-xl font-semibold">
            Saved versions
          </h2>
          {versions.length ? (
            <ul className="mt-4 grid gap-3">
              {versions.map((version) => (
                <li
                  key={version.stemVersionId}
                  className="rounded-control border-subtle bg-surface flex flex-wrap items-center justify-between gap-4 border p-4"
                >
                  <div>
                    <p className="font-semibold">
                      {version.name} · version {version.version}
                    </p>
                    <p className="text-muted text-sm">
                      {version.noteCount} notes · immutable
                    </p>
                  </div>
                  <ButtonLink
                    href={`/stems/new?mode=derive&parentVersionId=${version.stemVersionId}`}
                    variant="secondary"
                  >
                    Make a new draft
                  </ButtonLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted border-subtle rounded-control mt-4 border p-5">
              Immutable publication arrives with recording and MIDI interchange
              in MIDI-04. Draft save and reload are ready now.
            </p>
          )}
        </section>
      </Container>
    </main>
  );
}
