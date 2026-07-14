import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { MidiFeasibilityHarnessLauncher } from "@/features/midi/feasibility-harness-launcher.client";

export default function MidiFeasibilityPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main id="main-content">
      <Container className="py-12">
        <div className="mb-8 max-w-3xl">
          <p className="text-accent font-semibold tracking-wide uppercase">
            Development evidence
          </p>
          <h1 className="mt-2 text-4xl font-bold">MIDI engine feasibility</h1>
          <p className="text-muted mt-3 text-lg">
            A guarded adapter harness for format, scheduling, accessible note
            editing, synth construction, and browser fallback evidence.
          </p>
        </div>
        <MidiFeasibilityHarnessLauncher />
      </Container>
    </main>
  );
}
