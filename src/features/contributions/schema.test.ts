import { describe, expect, it } from "vitest";
import {
  CONTRIBUTOR_ATTESTATION_VERSION,
  MIDI_PUBLIC_LICENSE_CODE,
  createContributionSchema,
  reviewContributionSchema,
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
        expectedLicenseCode: MIDI_PUBLIC_LICENSE_CODE,
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
      expectedLicenseCode: MIDI_PUBLIC_LICENSE_CODE,
      attestationVersion: CONTRIBUTOR_ATTESTATION_VERSION,
      attested: true,
    } as const;
    expect(submitContributionSchema.safeParse(input).success).toBe(true);
    expect(
      submitContributionSchema.safeParse({ ...input, attested: false }).success,
    ).toBe(false);
    expect(
      submitContributionSchema.safeParse({
        ...input,
        expectedLicenseCode: "all-rights-reserved",
      }).success,
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

  it("requires feedback for request changes and rejection", () => {
    const input = {
      contributionId: id,
      requestId: id,
      expectedStatus: "submitted",
      expectedCurrentVersionId: id,
      expectedProjectRevisionId: id,
      note: "",
    } as const;
    expect(
      reviewContributionSchema.safeParse({
        ...input,
        decision: "request_changes",
      }).success,
    ).toBe(false);
    expect(
      reviewContributionSchema.safeParse({ ...input, decision: "accept" })
        .success,
    ).toBe(true);
    expect(
      reviewContributionSchema.safeParse({
        ...input,
        decision: "accept",
        note: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});
