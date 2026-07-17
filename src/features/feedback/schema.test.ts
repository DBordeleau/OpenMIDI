import { describe, expect, it } from "vitest";
import {
  adminFeedbackActionSchema,
  adminFeedbackFilterSchema,
  feedbackSubmissionSchema,
  sanitizeFeedbackPathname,
} from "./schema";

const validSubmission = {
  requestId: "fc100000-0000-4000-8000-000000000001",
  kind: "bug",
  summary: "Playback loses the beat",
  details: "Playback stops after the first full measure in Studio.",
  sourcePathname: "/studio/example",
  includeBrowserContext: false,
  browserContext: "",
};

describe("feedback input", () => {
  it("accepts bounded bug and suggestion payloads", () => {
    expect(feedbackSubmissionSchema.safeParse(validSubmission).success).toBe(
      true,
    );
    expect(
      feedbackSubmissionSchema.safeParse({
        ...validSubmission,
        kind: "suggestion",
      }).success,
    ).toBe(true);
  });

  it.each([
    { summary: "" },
    { summary: "x".repeat(121) },
    { details: "too short" },
    { details: "x".repeat(4001) },
    { sourcePathname: "https://example.test/studio" },
    { sourcePathname: "/studio?token=secret" },
    { sourcePathname: "//example.test/path" },
  ])("rejects invalid or unsafe payload %o", (change) => {
    expect(
      feedbackSubmissionSchema.safeParse({ ...validSubmission, ...change })
        .success,
    ).toBe(false);
  });

  it("requires opt-in for disclosed browser context", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        ...validSubmission,
        browserContext: "Firefox",
      }).success,
    ).toBe(false);
    expect(
      feedbackSubmissionSchema.safeParse({
        ...validSubmission,
        includeBrowserContext: true,
      }).success,
    ).toBe(false);
    expect(
      feedbackSubmissionSchema.safeParse({
        ...validSubmission,
        includeBrowserContext: true,
        browserContext: "Firefox on Linux",
      }).success,
    ).toBe(true);
  });

  it("sanitizes carried routes to an application pathname", () => {
    expect(sanitizeFeedbackPathname("/studio/demo?token=secret#clip")).toBe(
      "/studio/demo",
    );
    expect(sanitizeFeedbackPathname("https://example.test/private")).toBe(
      "/feedback",
    );
    expect(sanitizeFeedbackPathname("//example.test/private")).toBe(
      "/feedback",
    );
  });
});

describe("administrator feedback validation", () => {
  it("rejects malformed filters and incomplete deletion confirmation", () => {
    expect(
      adminFeedbackFilterSchema.safeParse({ status: "closed" }).success,
    ).toBe(false);
    expect(
      adminFeedbackFilterSchema.safeParse({
        kind: "bug",
        after: "x".repeat(513),
      }).success,
    ).toBe(false);
    expect(
      adminFeedbackActionSchema.safeParse({
        feedbackId: validSubmission.requestId,
        requestId: "fc200000-0000-4000-8000-000000000001",
        action: "delete",
        expectedLockVersion: 1,
        note: "",
        deletionReason: "no",
        confirmDelete: false,
      }).success,
    ).toBe(false);
  });
});
