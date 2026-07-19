import { describe, expect, it } from "vitest";
import { MIDI_V3_REUSE_LICENSE } from "@/features/midi/domain-v3";
import {
  V3_IDS,
  V3_MANIFEST_BEFORE,
  V3_PATTERN_VERSION_1,
} from "@/features/studio/manifest/v3.fixtures";
import { publicMidiPreviewResponseSchema } from "./contract";

const preview = {
  projectId: V3_IDS.project,
  revisionId: "30000000-0000-4000-8000-000000000050",
  revisionNumber: 2,
  projectTitle: "Night Pattern",
  manifest: V3_MANIFEST_BEFORE,
  patternVersions: [V3_PATTERN_VERSION_1],
  attributions: [{ kind: "publisher" as const, creditName: "Loop Maker" }],
};

describe("public MIDI preview response", () => {
  it("accepts project previews with license metadata", () => {
    expect(
      publicMidiPreviewResponseSchema.parse({
        ...preview,
        license: {
          code: "cc-by-4.0",
          name: "Creative Commons Attribution 4.0 International",
          url: MIDI_V3_REUSE_LICENSE.url,
        },
      }),
    ).toMatchObject({ projectTitle: "Night Pattern" });
  });

  it("accepts challenge-scoped previews without license metadata", () => {
    expect(publicMidiPreviewResponseSchema.parse(preview)).toMatchObject({
      projectTitle: "Night Pattern",
    });
  });
});
