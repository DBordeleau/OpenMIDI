import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal.client";
import { requireViewer } from "@/features/auth/guards";
import { SavedClipCard } from "@/features/midi-library/saved-clip-card";
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
      <Container className="py-6 sm:py-10">
        <Reveal>
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
                Private collection
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-balance sm:text-3xl">
                {/* Two complete phrasings rather than a truncated one; only
                    the displayed span reaches assistive technology. */}
                <span className="sm:hidden">
                  Clips you{" "}
                  <em className="text-accent font-serif font-medium">kept</em>.
                </span>
                <span className="hidden sm:inline">
                  Clips you kept, exactly as{" "}
                  <em className="text-accent font-serif font-medium">
                    written
                  </em>
                  .
                </span>
              </h1>
            </div>
            <ButtonLink href="/library" variant="secondary" prefetch={false}>
              Explore the library
            </ButtonLink>
          </header>
        </Reveal>

        {patterns.length ? (
          <section className="mt-6" aria-labelledby="saved-results">
            <Reveal delay={0.06} className="px-1">
              <h2 id="saved-results" className="text-muted text-sm">
                <span className="text-ink font-semibold">
                  {patterns.length} clip{patterns.length === 1 ? "" : "s"}
                </span>{" "}
                · bookmarked versions, no copied notes and no ownership transfer
              </h2>
            </Reveal>
            <ul className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {patterns.map((pattern, index) => (
                <Reveal
                  as="li"
                  key={pattern.midiPatternVersionId}
                  delay={0.1 + Math.min(index, 8) * 0.05}
                  className="flex"
                >
                  <SavedClipCard pattern={pattern} workspaces={workspaces} />
                </Reveal>
              ))}
            </ul>
          </section>
        ) : (
          <section className="rounded-card border-strong mt-6 border border-dashed p-10 text-center">
            <h2 className="text-2xl font-bold">No saved clips yet.</h2>
            <p className="text-muted mx-auto mt-2 max-w-xl">
              Bookmark a commercially reusable pattern and it lands here — the
              exact version, without duplicating its notes.
            </p>
            <div className="mt-5">
              <ButtonLink href="/library?rights=commercial_reuse">
                Find reusable MIDI
              </ButtonLink>
            </div>
          </section>
        )}

        <p className="text-muted mt-8 text-xs">
          Credits acknowledge sources; they do not replace the CC BY grant or
          prove permission. Open a clip&apos;s{" "}
          <Link prefetch={false} className="underline" href="/library">
            listing
          </Link>{" "}
          for its full attribution.
        </p>
      </Container>
    </main>
  );
}
