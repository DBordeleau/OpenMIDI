import { describe, expect, it } from "vitest";
import { STUDIO_FIXTURE_MANIFEST } from "@/features/studio/manifest/fixtures";
import { localRecoveryEnvelopeSchema } from "./schema";

describe("workspace local recovery envelope", () => {
  it("accepts only scoped versioned manifest intent", () => {
    expect(
      localRecoveryEnvelopeSchema.parse({
        version: 1,
        viewerId: "00000000-0000-4000-8000-000000000101",
        projectId: STUDIO_FIXTURE_MANIFEST.workspaceId,
        workspaceId: "00000000-0000-4000-8000-000000000102",
        baseRevisionId: "00000000-0000-4000-8000-000000000103",
        serverLockVersion: 1,
        manifest: STUDIO_FIXTURE_MANIFEST,
        manifestSha256: "a".repeat(64),
        savedAt: new Date().toISOString(),
        state: "pending",
      }).state,
    ).toBe("pending");
  });

  it("rejects extra sensitive or unversioned fields", () => {
    expect(() =>
      localRecoveryEnvelopeSchema.parse({
        version: 1,
        viewerId: "00000000-0000-4000-8000-000000000101",
        projectId: STUDIO_FIXTURE_MANIFEST.workspaceId,
        workspaceId: "00000000-0000-4000-8000-000000000102",
        baseRevisionId: "00000000-0000-4000-8000-000000000103",
        serverLockVersion: 1,
        manifest: STUDIO_FIXTURE_MANIFEST,
        manifestSha256: "a".repeat(64),
        savedAt: new Date().toISOString(),
        state: "pending",
        signedUrl: "https://example.test/private",
      }),
    ).toThrow();
  });
});
