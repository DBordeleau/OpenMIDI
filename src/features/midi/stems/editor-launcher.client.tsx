"use client";

import dynamic from "next/dynamic";
import type { MidiStemDraft } from "./types";

const MidiStemEditor = dynamic(
  () => import("./stem-editor.client").then((module) => module.MidiStemEditor),
  {
    ssr: false,
    loading: () => (
      <p
        role="status"
        className="text-muted rounded-card border-subtle bg-surface mt-8 border p-6"
      >
        Preparing your MIDI controls…
      </p>
    ),
  },
);

export function MidiStemEditorLauncher({ draft }: { draft: MidiStemDraft }) {
  return <MidiStemEditor draft={draft} />;
}
