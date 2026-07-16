import { describe, expect, it } from "vitest";
import { MIDI_V3_REUSE_LICENSE } from "@/features/midi/domain-v3";
import {
  V3_IDS,
  V3_MANIFEST_BEFORE,
  V3_PATTERN_VERSION_1,
} from "@/features/studio/manifest/v3.fixtures";
import { createLicensedMidiExport } from "./licensed-export";

describe("licensed public MIDI export", () => {
  it("packages MIDI with separate immutable attribution and CC BY 4.0 files", () => {
    const exported = createLicensedMidiExport({
      projectId: V3_IDS.project,
      revisionId: "30000000-0000-4000-8000-000000000050",
      revisionNumber: 2,
      projectTitle: "Night Pattern",
      license: {
        code: "cc-by-4.0",
        name: "Creative Commons Attribution 4.0 International",
        url: MIDI_V3_REUSE_LICENSE.url,
      },
      manifest: V3_MANIFEST_BEFORE,
      patternVersions: [
        {
          ...V3_PATTERN_VERSION_1,
          reuseLicense: MIDI_V3_REUSE_LICENSE,
        },
      ],
      attributions: [{ kind: "publisher", creditName: "Loop Maker" }],
    });
    const archiveText = new TextDecoder().decode(exported.bytes);

    expect(exported.filename).toBe("Night Pattern-revision-2-licensed.zip");
    expect(archiveText).toContain("MThd");
    expect(archiveText).toContain("ATTRIBUTION.json");
    expect(archiveText).toContain("LICENSE.txt");
    expect(archiveText).toContain(
      "Creative Commons Attribution 4.0 International",
    );
    expect(archiveText).toContain(V3_PATTERN_VERSION_1.midiPatternVersionId);
    expect(archiveText).toContain(MIDI_V3_REUSE_LICENSE.url);
    expect(exported.attribution.midiPatterns[0]).toMatchObject({
      creatorCreditName: "Loop Maker",
      midiPatternVersionId: V3_PATTERN_VERSION_1.midiPatternVersionId,
    });
  });

  it("refuses to label a differently licensed project as CC BY 4.0", () => {
    expect(() =>
      createLicensedMidiExport({
        projectId: V3_IDS.project,
        revisionId: "30000000-0000-4000-8000-000000000050",
        revisionNumber: 2,
        projectTitle: "Reserved Pattern",
        license: {
          code: "all-rights-reserved",
          name: "All rights reserved",
          url: "https://example.com/all-rights-reserved",
        },
        manifest: V3_MANIFEST_BEFORE,
        patternVersions: [V3_PATTERN_VERSION_1],
        attributions: [{ kind: "publisher", creditName: "Loop Maker" }],
      }),
    ).toThrow("public_midi_export_requires_cc_by_4_0");
  });
});
