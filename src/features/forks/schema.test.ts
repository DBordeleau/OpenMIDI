import { describe, expect, it } from "vitest";
import {
  defaultForkTitle,
  FORK_RIGHTS_ATTESTATION_VERSION,
  forkProjectInputSchema,
} from "./schema";

const validInput = {
  sourceProjectId: "10000000-0000-4000-8000-000000000001",
  sourceRevisionId: "20000000-0000-4000-8000-000000000001",
  requestId: "30000000-0000-4000-8000-000000000001",
  expectedLicenseCode: "cc-by-4.0",
  rightsAttestationVersion: FORK_RIGHTS_ATTESTATION_VERSION,
  attested: true,
  title: "A fork",
  description: "A new direction",
};

describe("forkProjectInputSchema", () => {
  it("normalizes a blank description", () => {
    expect(
      forkProjectInputSchema.parse({ ...validInput, description: "  " })
        .description,
    ).toBeNull();
  });

  it("rejects malformed identifiers and oversized metadata", () => {
    const result = forkProjectInputSchema.safeParse({
      ...validInput,
      sourceRevisionId: "not-a-revision",
      title: "x".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it("requires explicit CC BY 4.0 reuse attestation", () => {
    expect(
      forkProjectInputSchema.safeParse({ ...validInput, attested: false })
        .success,
    ).toBe(false);
    expect(
      forkProjectInputSchema.safeParse({
        ...validInput,
        expectedLicenseCode: "all-rights-reserved",
      }).success,
    ).toBe(false);
  });
});

describe("defaultForkTitle", () => {
  it("uses the familiar fork prefix when it fits", () => {
    expect(defaultForkTitle("Night Drive")).toBe("Fork of Night Drive");
  });

  it("keeps long Unicode titles within the database limit", () => {
    const title = defaultForkTitle("🎵".repeat(120));
    expect(Array.from(title)).toHaveLength(120);
    expect(title.endsWith(" (fork)")).toBe(true);
  });
});
