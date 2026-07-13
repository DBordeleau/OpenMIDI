"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { publishSelectionSchema } from "./schema";
import {
  listPublishOptions,
  publishRevision,
} from "@/server/repositories/revisions";
import { getProjectForViewer } from "@/server/repositories/projects";
import {
  parseWorkspaceManifest,
  STUDIO_ENGINE_VERSION,
} from "@/features/studio/manifest/schema";

export type PublishState = {
  message?: string;
  fields?: Record<string, string[]>;
};
export async function publishProjectAction(
  projectId: string,
  _state: PublishState,
  formData: FormData,
): Promise<PublishState> {
  let rawTracks: unknown;
  try {
    rawTracks = JSON.parse(String(formData.get("tracks") ?? "[]"));
  } catch {
    rawTracks = [];
  }
  const parsed = publishSelectionSchema.safeParse({
    requestId: formData.get("requestId"),
    tracks: rawTracks,
    message: formData.get("message") ?? "",
  });
  if (!parsed.success)
    return {
      message: "Check the selected stems and labels.",
      fields: parsed.error.flatten().fieldErrors,
    };
  const [project, options] = await Promise.all([
    getProjectForViewer(projectId),
    listPublishOptions(),
  ]);
  if (!project) return { message: "This project is unavailable." };
  if (project.currentRevisionId)
    return {
      message: "This project already has a revision. Reload to continue.",
    };
  if (project.bpm === null)
    return { message: "Set the project tempo before publishing." };
  const byId = new Map(options.assets.map((asset) => [asset.id, asset]));
  const activeInstruments = new Set(options.instruments.map(({ id }) => id));
  if (
    parsed.data.tracks.some(
      (track) =>
        !byId.has(track.assetId) ||
        (track.instrumentId && !activeInstruments.has(track.instrumentId)),
    )
  )
    return { message: "One or more selected stems are no longer available." };
  const manifest = parseWorkspaceManifest({
    manifestVersion: 1,
    engine: "waveform-playlist",
    engineVersion: STUDIO_ENGINE_VERSION,
    workspaceId: projectId,
    tempoBpm: project.bpm,
    tracks: parsed.data.tracks.map((track, sortOrder) => ({
      trackId: track.trackId,
      assetId: track.assetId,
      instrumentId: track.instrumentId,
      name: track.name,
      positionMs: 0,
      trimStartMs: 0,
      durationMs: byId.get(track.assetId)!.durationMs,
      gainDb: 0,
      pan: 0,
      muted: false,
      soloed: false,
      sortOrder,
    })),
  });
  const { data, error } = await publishRevision({
    projectId,
    requestId: parsed.data.requestId,
    expectedCurrentRevisionId: null,
    message: parsed.data.message || null,
    manifest,
  });
  if (error || !data?.[0]) {
    const safe =
      error?.code === "PT429"
        ? "Publishing would exceed the 250 MiB project limit."
        : error?.code === "PT409"
          ? "The project or selected stems changed. Reload and review before retrying."
          : "We couldn’t publish this revision. Please try again.";
    return { message: safe };
  }
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}#revision-${data[0].revision_number}`);
}
