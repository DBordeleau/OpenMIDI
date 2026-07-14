import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/ui/reveal.client";
import { requireViewer } from "@/features/auth/guards";
import { createMidiStemDraftAction } from "@/features/midi/stems/actions";
import { CreateMidiStemForm } from "@/features/midi/stems/create-stem-form.client";

export const metadata: Metadata = { title: "New MIDI stem" };

export default async function NewMidiStemPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; parentVersionId?: string }>;
}) {
  const query = await searchParams;
  const entryMode =
    query.mode === "import"
      ? "import"
      : query.mode === "derive"
        ? "derive"
        : query.mode && query.mode !== "blank"
          ? null
          : "blank";
  if (!entryMode || (entryMode === "derive" && !query.parentVersionId))
    notFound();
  await requireViewer(
    `/stems/new${entryMode === "blank" ? "" : `?mode=${entryMode}`}`,
  );
  const descriptions = {
    blank:
      "Begin with a quiet four-bar canvas and choose one deterministic bundled sound.",
    import:
      "Open an import-ready private draft. Standard MIDI file parsing follows in the interchange slice.",
    derive:
      "Start from one exact immutable version. Its history remains untouched.",
  } as const;
  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="mx-auto max-w-2xl">
          <Reveal>
            <p className="text-accent-2 font-mono text-xs font-semibold tracking-[0.2em] uppercase">
              Private MIDI draft
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">
              Name the idea
            </h1>
            <p className="text-muted mt-3">{descriptions[entryMode]}</p>
          </Reveal>
          <Reveal delay={0.08}>
            <CreateMidiStemForm
              action={createMidiStemDraftAction}
              requestId={randomUUID()}
              entryMode={entryMode}
              parentStemVersionId={query.parentVersionId ?? null}
            />
          </Reveal>
        </section>
      </Container>
    </main>
  );
}
