import { describe, expect, it } from "vitest";
import { moderationActionSchema, reportInputSchema } from "./schema";

describe("moderation schemas", () => {
  it("accepts a bounded fixed-reason report", () => {
    expect(
      reportInputSchema.parse({
        requestId: crypto.randomUUID(),
        targetKind: "project",
        targetId: crypto.randomUUID(),
        reason: "spam",
        detail: "Repeated unsolicited promotion",
      }).reason,
    ).toBe("spam");
  });

  it("rejects unbounded report detail and stale action versions", () => {
    expect(
      reportInputSchema.safeParse({
        requestId: crypto.randomUUID(),
        targetKind: "profile",
        targetId: crypto.randomUUID(),
        reason: "other",
        detail: "x".repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      moderationActionSchema.safeParse({
        reportId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        action: "hide",
        reason: "Reviewed",
        expectedReportStatus: "submitted",
        expectedTargetVersion: 0,
      }).success,
    ).toBe(false);
  });
});
