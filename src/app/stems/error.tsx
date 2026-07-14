"use client";

import { Container } from "@/components/layout/container";

export default function MidiStemsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="rounded-card border-danger bg-surface border p-8">
          <h1 className="text-2xl font-semibold">
            Your MIDI stems couldn’t open.
          </h1>
          <p className="text-muted mt-3">
            Your drafts are still private and unchanged. Try loading the library
            again.
          </p>
          <button
            onClick={reset}
            className="cta-gradient text-accent-contrast mt-6 min-h-11 rounded-full px-5 text-sm font-semibold"
          >
            Try again
          </button>
        </section>
      </Container>
    </main>
  );
}
