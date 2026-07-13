import { describe, expect, it } from "vitest";
import { workspaceAudioSourcesRequestSchema } from "./source-contract";

describe("workspace audio source contract", () => {
  it("accepts exact-load and single-add shapes", () => {
    expect(
      workspaceAudioSourcesRequestSchema.parse({
        mode: "load",
        assetIds: ["00000000-0000-4000-8000-000000000001"],
      }).mode,
    ).toBe("load");
    expect(
      workspaceAudioSourcesRequestSchema.parse({
        mode: "add",
        assetId: "00000000-0000-4000-8000-000000000002",
      }).mode,
    ).toBe("add");
  });

  it("rejects duplicate load IDs and broad add sets", () => {
    const assetId = "00000000-0000-4000-8000-000000000001";
    expect(
      workspaceAudioSourcesRequestSchema.safeParse({
        mode: "load",
        assetIds: [assetId, assetId],
      }).success,
    ).toBe(false);
    expect(
      workspaceAudioSourcesRequestSchema.safeParse({
        mode: "add",
        assetIds: [assetId],
      }).success,
    ).toBe(false);
  });
});
