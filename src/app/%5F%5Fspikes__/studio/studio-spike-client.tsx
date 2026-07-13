"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { WorkspaceManifestV1 } from "@/features/studio/manifest/schema";
import type { StudioAssetSource } from "@/features/studio/studio-adapter.types";

const StudioSurface = dynamic(
  () =>
    import("@/features/studio/waveform-playlist-adapter/index.client").then(
      (module) => module.StudioSurface,
    ),
  {
    ssr: false,
    loading: () => <p role="status">Loading the browser-only studio module…</p>,
  },
);

export function StudioSpikeClient(props: {
  initialManifest: WorkspaceManifestV1;
  assets: readonly StudioAssetSource[];
}) {
  const [opened, setOpened] = useState(false);
  if (!opened)
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-8">
        <p className="text-accent text-sm font-semibold tracking-widest uppercase">
          Architecture spike
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          Waveform Playlist studio boundary
        </h1>
        <p className="text-muted mt-3 max-w-3xl">
          Editor code and fixture audio remain unloaded until you explicitly
          open this removable development surface.
        </p>
        <button
          type="button"
          onClick={() => setOpened(true)}
          className="rounded-control bg-accent text-accent-contrast mt-6 min-h-11 px-5 py-3 font-semibold"
        >
          Open studio
        </button>
      </main>
    );
  return <StudioSurface {...props} />;
}
