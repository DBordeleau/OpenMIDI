import type { WorkspaceManifestV1 } from "@/features/studio/manifest/schema";

export type WorkspaceAssetOption = {
  id: string;
  filename: string;
  durationMs: number;
  creditName: string;
};

export type WorkspaceInstrumentOption = { id: string; name: string };

export type EditableWorkspace = {
  id: string;
  projectId: string;
  ownerId: string;
  baseRevisionId: string;
  lockVersion: number;
  manifest: WorkspaceManifestV1;
  manifestSha256: string;
  updatedAt: string;
  tracks: Array<{
    trackId: string;
    assetId: string;
    instrumentName: string | null;
    creditName: string;
  }>;
};
