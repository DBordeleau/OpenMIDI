import { describe, expect, it } from "vitest";
import {
  CONTRIBUTOR_ATTESTATION_VERSION,
  createContributionSchema,
  submitContributionSchema,
  withdrawContributionSchema,
} from "./schema";

const id = "10000000-0000-4000-8000-000000000001";

describe("contribution schemas", () => {
  it("normalizes creation text", () => {
    expect(
      createContributionSchema.parse({
        requestId: id,
        expectedCurrentRevisionId: id,
        title: "  New bridge  ",
        description: "   ",
      }),
    ).toMatchObject({ title: "New bridge", description: null });
  });

  it("requires the exact approved attestation and an explicit check", () => {
    const input = {
      contributionId: id,
      requestId: id,
      expectedWorkspaceLockVersion: 2,
      expectedBaseRevisionId: id,
      expectedManifestSha256: "a".repeat(64),
      attestationVersion: CONTRIBUTOR_ATTESTATION_VERSION,
      attested: true,
    } as const;
    expect(submitContributionSchema.safeParse(input).success).toBe(true);
    expect(
      submitContributionSchema.safeParse({ ...input, attested: false }).success,
    ).toBe(false);
  });

  it("allows a draft withdrawal without a submitted version", () => {
    expect(
      withdrawContributionSchema.safeParse({
        contributionId: id,
        expectedStatus: "draft",
        expectedCurrentVersionId: null,
      }).success,
    ).toBe(true);
  });
});
