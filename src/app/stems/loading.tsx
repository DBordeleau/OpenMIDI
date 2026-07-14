import { Container } from "@/components/layout/container";

export default function MidiStemsLoading() {
  return (
    <main id="main-content">
      <Container className="py-16">
        <p
          role="status"
          className="text-muted rounded-card border-subtle bg-surface border p-8"
        >
          Opening your MIDI stem library…
        </p>
      </Container>
    </main>
  );
}
