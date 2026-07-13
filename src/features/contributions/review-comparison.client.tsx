"use client";

import { useState } from "react";
import {
  StudioLauncher,
  type StudioLauncherProps,
} from "@/features/studio/components/studio-launcher.client";

export function ReviewComparison({
  submitted,
  current,
}: {
  submitted: StudioLauncherProps;
  current: StudioLauncherProps;
}) {
  const [selection, setSelection] = useState<"submitted" | "current">(
    "submitted",
  );
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold">Audition and compare</h2>
      <p className="text-muted mt-2">
        One private read-only studio loads at a time.
      </p>
      <div className="my-4 flex gap-3" role="group" aria-label="Review source">
        <button
          className="rounded-control border-strong min-h-11 border px-4"
          aria-pressed={selection === "submitted"}
          type="button"
          onClick={() => setSelection("submitted")}
        >
          Submitted version
        </button>
        <button
          className="rounded-control border-strong min-h-11 border px-4"
          aria-pressed={selection === "current"}
          type="button"
          onClick={() => setSelection("current")}
        >
          Current revision
        </button>
      </div>
      {selection === "submitted" ? (
        <StudioLauncher key="submitted" {...submitted} />
      ) : (
        <StudioLauncher key="current" {...current} />
      )}
    </section>
  );
}
