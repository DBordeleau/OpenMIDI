import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "./redirect";

describe("sanitizeNextPath", () => {
  it.each([
    ["/settings/profile?tab=public", "/settings/profile?tab=public"],
    ["/onboarding", "/onboarding"],
    ["https://evil.example", "/onboarding"],
    ["//evil.example", "/onboarding"],
    ["/%2f%2fevil.example", "/onboarding"],
    ["/settings%5cprofile", "/onboarding"],
    ["/unknown", "/onboarding"],
    [" /settings/profile", "/onboarding"],
  ])("sanitizes %s", (input, expected) =>
    expect(sanitizeNextPath(input)).toBe(expected),
  );
});
