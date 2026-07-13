import { notFound, redirect } from "next/navigation";
import { StudioSpikeClient } from "./studio-spike-client";
import { requireViewer } from "@/features/auth/guards";
import {
  STUDIO_FIXTURE_ASSETS,
  STUDIO_FIXTURE_MANIFEST,
} from "@/features/studio/manifest/fixtures";

export const dynamic = "force-dynamic";

export default async function StudioSpikePage() {
  const enabled = process.env.ENABLE_STUDIO_SPIKE === "true";
  const isPreview = process.env.VERCEL_ENV === "preview";
  if (!enabled || (process.env.NODE_ENV === "production" && !isPreview))
    notFound();

  const profile = await requireViewer("/__spikes__/studio");
  if (!profile.profileCompletedAt) redirect("/onboarding");

  return (
    <StudioSpikeClient
      initialManifest={STUDIO_FIXTURE_MANIFEST}
      assets={STUDIO_FIXTURE_ASSETS}
    />
  );
}
