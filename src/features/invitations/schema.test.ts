import { describe, expect, it } from "vitest";
import { adminInviteSchema } from "./schema";

describe("admin invitation schema", () => {
  it("trims and accepts a conventional address", () => {
    expect(
      adminInviteSchema.parse({ email: "  Musician@Example.Test  " }),
    ).toEqual({ email: "Musician@Example.Test" });
  });

  it.each(["", "not-an-email", "person @example.test"])(
    "rejects invalid input %j",
    (email) => {
      expect(adminInviteSchema.safeParse({ email }).success).toBe(false);
    },
  );

  it("rejects addresses longer than 254 characters", () => {
    const email = `${"a".repeat(243)}@example.test`;
    expect(adminInviteSchema.safeParse({ email }).success).toBe(false);
  });
});
