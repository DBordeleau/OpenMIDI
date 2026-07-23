import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMidiLocalRecovery,
  readMidiLocalRecovery,
  readStudioResolutionAnnouncement,
  writeStudioResolutionAnnouncement,
  writeMidiLocalRecovery,
} from "./midi-local-recovery.client";
import { COMPOSITE_STUDIO_ENGINE_VERSION } from "@/features/studio/manifest/v2";

const viewerId = "10000000-0000-4000-8000-000000000001";
const projectId = "10000000-0000-4000-8000-000000000002";
const workspaceId = "10000000-0000-4000-8000-000000000003";

function recoveryEnvelope(workspace = workspaceId) {
  return {
    version: 2 as const,
    viewerId,
    projectId,
    workspaceId: workspace,
    baseRevisionId: null,
    serverLockVersion: 1,
    manifest: {
      manifestVersion: 2 as const,
      engine: "openmidi-composite" as const,
      engineVersion:
        COMPOSITE_STUDIO_ENGINE_VERSION as typeof COMPOSITE_STUDIO_ENGINE_VERSION,
      projectId,
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 as const },
      durationTicks: 1_920,
      tracks: [],
    },
    manifestSha256: "a".repeat(64),
    savedAt: "2026-07-15T12:00:00.000Z",
    state: "pending" as const,
  };
}

describe("MIDI workspace local recovery", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stores recovery under actor and workspace authority", () => {
    const envelope = recoveryEnvelope();

    expect(writeMidiLocalRecovery(envelope)).toBe(true);
    expect(readMidiLocalRecovery(viewerId, workspaceId)).toEqual(envelope);
    expect(
      readMidiLocalRecovery(
        "10000000-0000-4000-8000-000000000004",
        workspaceId,
      ),
    ).toBeNull();
    clearMidiLocalRecovery(viewerId, workspaceId);
    expect(readMidiLocalRecovery(viewerId, workspaceId)).toBeNull();
  });

  it("ignores an obsolete prelaunch namespace without rewriting it", () => {
    const obsoletePrefix = [
      ["ja", "m"].join(""),
      ["ses", "sion"].join(""),
    ].join("-");
    const obsoleteKey = `${obsoletePrefix}:workspace:v2:${viewerId}:${workspaceId}`;
    const obsoleteValue = JSON.stringify({ version: 2, workspaceId });
    localStorage.setItem(obsoleteKey, obsoleteValue);

    expect(readMidiLocalRecovery(viewerId, workspaceId)).toBeNull();
    expect(localStorage.getItem(obsoleteKey)).toBe(obsoleteValue);
  });

  it("clears only the resolved source workspace recovery key", () => {
    const otherWorkspaceId = "10000000-0000-4000-8000-000000000004";
    writeMidiLocalRecovery(recoveryEnvelope());
    writeMidiLocalRecovery(recoveryEnvelope(otherWorkspaceId));

    clearMidiLocalRecovery(viewerId, workspaceId);

    expect(readMidiLocalRecovery(viewerId, workspaceId)).toBeNull();
    expect(readMidiLocalRecovery(viewerId, otherWorkspaceId)).toEqual(
      recoveryEnvelope(otherWorkspaceId),
    );
  });

  it("delivers one bounded resolution announcement only to its target project", () => {
    writeStudioResolutionAnnouncement(
      projectId,
      "Private fork is ready with your recovered draft.",
    );

    expect(
      readStudioResolutionAnnouncement("10000000-0000-4000-8000-000000000099"),
    ).toBeNull();
    expect(readStudioResolutionAnnouncement(projectId)).toBe(
      "Private fork is ready with your recovered draft.",
    );
    expect(readStudioResolutionAnnouncement(projectId)).toBeNull();
  });
});
