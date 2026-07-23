import { describe, expect, it } from "vitest";
import { resolveStaleOwnerWorkspaceSchema } from "./schema";

const authority = {
  workspaceId: "10000000-0000-4000-8000-000000000001",
  requestId: "10000000-0000-4000-8000-000000000002",
  expectedWorkspaceLockVersion: 2,
  expectedBaseRevisionId: "10000000-0000-4000-8000-000000000003",
  expectedCurrentRevisionId: "10000000-0000-4000-8000-000000000004",
};

describe("stale owner workspace resolution schema", () => {
  it("accepts only the restart variant without a fork title", () => {
    expect(
      resolveStaleOwnerWorkspaceSchema.parse({
        ...authority,
        resolution: "restart_latest",
        forkTitle: null,
      }),
    ).toEqual({
      ...authority,
      resolution: "restart_latest",
      forkTitle: null,
    });
    expect(
      resolveStaleOwnerWorkspaceSchema.safeParse({
        ...authority,
        resolution: "restart_latest",
        forkTitle: "Unexpected",
      }).success,
    ).toBe(false);
  });

  it("normalizes a required 1-120 character recovered-fork title", () => {
    expect(
      resolveStaleOwnerWorkspaceSchema.parse({
        ...authority,
        resolution: "preserve_as_fork",
        forkTitle: "  Recovered take  ",
      }).forkTitle,
    ).toBe("Recovered take");
    expect(
      resolveStaleOwnerWorkspaceSchema.safeParse({
        ...authority,
        resolution: "preserve_as_fork",
        forkTitle: " ",
      }).success,
    ).toBe(false);
  });

  it("requires exact UUID authority and a positive acknowledged lock", () => {
    expect(
      resolveStaleOwnerWorkspaceSchema.safeParse({
        ...authority,
        expectedWorkspaceLockVersion: 0,
        resolution: "restart_latest",
        forkTitle: null,
      }).success,
    ).toBe(false);
    expect(
      resolveStaleOwnerWorkspaceSchema.safeParse({
        ...authority,
        expectedCurrentRevisionId: "not-a-revision",
        resolution: "restart_latest",
        forkTitle: null,
      }).success,
    ).toBe(false);
  });
});
