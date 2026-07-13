import { beforeEach, describe, expect, it } from "vitest";
import { STUDIO_FIXTURE_MANIFEST } from "@/features/studio/manifest/fixtures";
import {
  clearLocalRecovery,
  readLocalRecovery,
  writeLocalRecovery,
} from "./local-recovery.client";

const viewerId = "00000000-0000-4000-8000-000000000101";
const workspaceId = "00000000-0000-4000-8000-000000000102";
const envelope = {
  version: 1 as const,
  viewerId,
  projectId: STUDIO_FIXTURE_MANIFEST.workspaceId,
  workspaceId,
  baseRevisionId: "00000000-0000-4000-8000-000000000103",
  serverLockVersion: 1,
  manifest: STUDIO_FIXTURE_MANIFEST,
  manifestSha256: "a".repeat(64),
  savedAt: "2026-07-13T00:00:00.000Z",
  state: "pending" as const,
};

describe("workspace local recovery storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips only within the viewer and workspace scope", () => {
    expect(writeLocalRecovery(envelope)).toBe(true);
    expect(readLocalRecovery(viewerId, workspaceId)).toEqual(envelope);
    expect(
      readLocalRecovery("00000000-0000-4000-8000-000000000999", workspaceId),
    ).toBeNull();
  });

  it("drops malformed data and clears acknowledged intent", () => {
    window.localStorage.setItem(
      `jam-session:workspace:v1:${viewerId}:${workspaceId}`,
      '{"signedUrl":"private"}',
    );
    expect(readLocalRecovery(viewerId, workspaceId)).toBeNull();
    expect(window.localStorage.length).toBe(0);

    writeLocalRecovery(envelope);
    clearLocalRecovery(viewerId, workspaceId);
    expect(readLocalRecovery(viewerId, workspaceId)).toBeNull();
  });
});
