import { describe, expect, it } from "vitest";
import { challengeEntryPageHref, challengeRotationKey } from "./rotation";

const base = {
  challengeId: "10000000-0000-4000-8000-000000000001",
  challengeVersionId: "20000000-0000-4000-8000-000000000001",
  entryId: "30000000-0000-4000-8000-000000000001",
  rotationBucket: "2026-07-18T20:00:00.000Z",
};

describe("challenge rotation", () => {
  it("is stable inside one UTC bucket and changes in the next bucket", async () => {
    await expect(challengeRotationKey(base)).resolves.toBe(
      await challengeRotationKey({ ...base }),
    );
    await expect(
      challengeRotationKey({
        ...base,
        rotationBucket: "2026-07-18T21:00:00.000Z",
      }),
    ).resolves.not.toBe(await challengeRotationKey(base));
  });

  it("uses only challenge/version, entry, and the UTC bucket", async () => {
    const first = await challengeRotationKey(base);
    const second = await challengeRotationKey({
      ...base,
      entryId: "30000000-0000-4000-8000-000000000002",
    });
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).not.toBe(first);
  });

  it("rejects a non-hour bucket", async () => {
    await expect(
      challengeRotationKey({
        ...base,
        rotationBucket: "2026-07-18T20:01:00.000Z",
      }),
    ).rejects.toThrow("challenge_rotation_bucket_invalid");
  });

  it("preserves the bucket and stable cursor in application pagination links", () => {
    expect(
      challengeEntryPageHref({
        slug: "one-hour-groove",
        rotationBucket: base.rotationBucket,
        rotationKey: "a".repeat(64),
        entryId: base.entryId,
      }),
    ).toContain(
      "rotationBucket=2026-07-18T20%3A00%3A00.000Z&afterRotationKey=",
    );
  });
});
