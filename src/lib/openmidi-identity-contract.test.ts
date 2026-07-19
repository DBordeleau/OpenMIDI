import { describe, expect, it } from "vitest";

// The executable contract is JavaScript so it can run before TypeScript tooling.
// @ts-expect-error The repository does not emit declarations for scripts.
import { hasFormerIdentity } from "../../scripts/check-openmidi-identity.mjs";

const formerWords = [["ja", "m"].join(""), ["ses", "sion"].join("")];

describe("OpenMIDI identity contract", () => {
  it.each([" ", "-", "_", ""])(
    "rejects the former identity with %j separation",
    (separator) => {
      expect(hasFormerIdentity(formerWords.join(separator))).toBe(true);
      expect(hasFormerIdentity(formerWords.join(separator).toUpperCase())).toBe(
        true,
      );
    },
  );

  it("allows the canonical identity", () => {
    expect(hasFormerIdentity("OpenMIDI openmidi-midi openmidi:")).toBe(false);
  });
});
