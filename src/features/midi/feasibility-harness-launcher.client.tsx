"use client";

import dynamic from "next/dynamic";

const MidiFeasibilityHarness = dynamic(
  () =>
    import("./feasibility-harness.client").then(
      (module) => module.MidiFeasibilityHarness,
    ),
  { ssr: false, loading: () => <p role="status">Preparing MIDI evidence…</p> },
);

export function MidiFeasibilityHarnessLauncher() {
  return <MidiFeasibilityHarness />;
}
