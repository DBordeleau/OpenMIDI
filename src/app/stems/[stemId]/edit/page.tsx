import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { MidiStemEditorLauncher } from "@/features/midi/stems/editor-launcher.client";
import { getMidiStemDraft } from "@/server/repositories/midi-stems";

export const metadata: Metadata = { title: "MIDI stem editor" };

export default async function EditMidiStemPage({
  params,
}: {
  params: Promise<{ stemId: string }>;
}) {
  const { stemId: rawStemId } = await params;
  const parsed = z.uuid().safeParse(rawStemId);
  if (!parsed.success) notFound();
  await requireViewer(`/stems/${parsed.data}/edit`);
  const draft = await getMidiStemDraft(parsed.data);
  if (!draft) notFound();
  return (
    <main id="main-content">
      <Container className="py-10 sm:py-14">
        <Link
          href="/stems"
          className="text-muted hover:text-accent text-sm font-semibold"
        >
          ← Back to My stems
        </Link>
        <div className="mt-5">
          <p className="text-accent-2 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
            Standalone MIDI editor
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Shape a reusable stem
          </h1>
          <p className="text-muted mt-3 max-w-3xl">
            This private draft is the note authority. Project arrangement stays
            separate, and no audio file is uploaded.
          </p>
        </div>
        <MidiStemEditorLauncher draft={draft} />
      </Container>
    </main>
  );
}
