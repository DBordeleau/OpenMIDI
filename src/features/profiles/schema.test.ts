import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";

describe("profileSchema", () => {
  it("accepts profile boundaries and normalizes an empty bio", () => {
    expect(
      profileSchema.parse({
        username: "abc",
        displayName: "A",
        creditName: "C",
        bio: " ",
      }).bio,
    ).toBeNull();
  });
  it.each(["@artist", "ab", "artist-name", " name"])(
    "rejects username %s",
    (username) => {
      expect(
        profileSchema.safeParse({
          username,
          displayName: "A",
          creditName: "C",
          bio: "",
        }).success,
      ).toBe(false);
    },
  );
});
