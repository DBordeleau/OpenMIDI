import { describe, expect, it } from "vitest";
import { encodeNavigationCursor } from "@/features/navigation/cursor";
import { decodeAdminFeedbackCursor } from "./admin-cursor";

const adminId = "fc000000-0000-4000-8000-000000000006";
const cursor = {
  v: 1 as const,
  kind: "admin-feedback" as const,
  subject: adminId,
  filter: "new:bug",
  timestamp: "2026-07-17T18:00:00.000Z",
  id: "fc400000-0000-4000-8000-000000000001",
};

describe("administrator feedback cursor", () => {
  it("accepts only the same administrator and filter context", () => {
    const encoded = encodeNavigationCursor(cursor);
    expect(decodeAdminFeedbackCursor(encoded, adminId, "new:bug")).toEqual(
      cursor,
    );
    expect(
      decodeAdminFeedbackCursor(
        encoded,
        "fc000000-0000-4000-8000-000000000002",
        "new:bug",
      ),
    ).toBeNull();
    expect(
      decodeAdminFeedbackCursor(encoded, adminId, "handled:bug"),
    ).toBeNull();
  });

  it("rejects malformed and cross-feature cursor values", () => {
    expect(
      decodeAdminFeedbackCursor("malformed", adminId, "new:bug"),
    ).toBeNull();
    const other = encodeNavigationCursor({
      ...cursor,
      kind: "admin-moderation",
    });
    expect(decodeAdminFeedbackCursor(other, adminId, "new:bug")).toBeNull();
  });
});
