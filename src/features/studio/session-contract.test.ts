import { describe, expect, it } from "vitest";
import { V3_MANIFEST_BEFORE } from "./manifest/v3.fixtures";
import { parseStudioSessionDescriptor } from "./session-contract";

const capabilities = {
  canEdit: true,
  canPublish: true,
  canSubmit: false,
  canStartContribution: false,
  canFork: true,
};

describe("route-neutral Studio session descriptor", () => {
  it("parses an authorized owner workspace independently of route shape", () => {
    const projectId = V3_MANIFEST_BEFORE.projectId;
    const descriptor = parseStudioSessionDescriptor({
      mode: "ownerWorkspace",
      viewerId: "10000000-0000-4000-8000-000000000123",
      project: {
        projectId,
        title: "Exact take",
        compatibility: "midi",
        currentRevisionId: null,
      },
      manifest: V3_MANIFEST_BEFORE,
      authority: {
        kind: "workspace",
        workspaceId: "10000000-0000-4000-8000-000000000124",
        baseRevisionId: null,
        lockVersion: 0,
      },
      capabilities,
      canonicalLinks: {
        project: `/projects/${projectId}`,
        studio: `/studio/${projectId}`,
        completion: `/projects/${projectId}/publish`,
      },
    });
    expect(descriptor.capabilities).toEqual(capabilities);
    expect(descriptor.mode).toBe("ownerWorkspace");
  });

  it("requires explicit server-derived capability flags and safe canonical links", () => {
    expect(() =>
      parseStudioSessionDescriptor({
        mode: "empty",
        viewerId: "10000000-0000-4000-8000-000000000123",
        project: null,
        manifest: null,
        authority: null,
        capabilities: { canEdit: false },
        canonicalLinks: {
          project: null,
          studio: "/studio",
          completion: "/projects/new",
        },
      }),
    ).toThrow();
  });
});
