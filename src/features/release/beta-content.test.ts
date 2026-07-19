import { describe, expect, it } from "vitest";
import { patternContentV3Schema } from "@/features/midi/domain-v3";
import { challengeConstraintsV1Schema } from "@/features/challenges/constraint-v1";
import {
  parseWorkspaceManifestV3,
  sha256PatternContentV3,
} from "@/features/studio/manifest/v3";
import { sha256PostgresJsonb } from "@/features/studio/manifest/canonical-json";
import { release02BetaContent } from "./beta-content";

describe("RELEASE-02 beta content", () => {
  it("round-trips every compact pattern with its reviewed hash", async () => {
    for (const pattern of release02BetaContent.patterns) {
      const content = patternContentV3Schema.parse({
        ppq: 480,
        durationTicks: pattern.durationTicks,
        notes: pattern.notes,
      });
      expect(await sha256PatternContentV3(content), pattern.key).toBe(
        pattern.expectedContentSha256,
      );
      expect(JSON.parse(JSON.stringify(content))).toEqual(content);
    }
  });

  it("keeps the reviewed rights modes consistent with project forks", () => {
    const patternsByKey = new Map(
      release02BetaContent.patterns.map((pattern) => [pattern.key, pattern]),
    );
    expect(
      release02BetaContent.patterns
        .filter(({ reuseMode }) => reuseMode === "commercial_reuse")
        .map(({ key }) => key)
        .sort(),
    ).toEqual(["circuit-drums", "circuit-hook", "neon-bass", "neon-pocket"]);
    expect(
      release02BetaContent.patterns
        .filter(({ reuseMode }) => reuseMode === "reference_only")
        .map(({ key }) => key)
        .sort(),
    ).toEqual(["neon-reply", "windowlight-air", "windowlight-chords"]);
    expect(
      release02BetaContent.projects.find(({ key }) => key === "neon-steps")
        ?.licenseCode,
    ).toBe("all-rights-reserved");
    for (const project of release02BetaContent.projects) {
      if (project.licenseCode !== "cc-by-4.0") {
        continue;
      }
      expect(
        project.tracks.every(
          ({ patternKey }) =>
            patternsByKey.get(patternKey)?.reuseMode === "commercial_reuse",
        ),
        project.key,
      ).toBe(true);
    }
    expect(
      release02BetaContent.patterns.reduce(
        (count, pattern) => count + pattern.notes.length,
        0,
      ),
    ).toBeLessThan(64);
    expect(release02BetaContent.rightsReview.basis).toMatch(
      /composed specifically/i,
    );
  });

  it("builds canonical manifest-v3 workspaces from the reviewed blueprints", () => {
    const patternVersions = new Map(
      release02BetaContent.patterns.map((pattern, index) => [
        pattern.key,
        `b0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      ]),
    );
    for (const [
      projectIndex,
      project,
    ] of release02BetaContent.projects.entries()) {
      const parsed = parseWorkspaceManifestV3({
        manifestVersion: 3,
        engine: "openmidi-midi",
        engineVersion: "openmidi-midi-3_tone-15.1.22_presets-1",
        projectId: `b1000000-0000-4000-8000-${String(projectIndex + 1).padStart(12, "0")}`,
        workspaceId: `b2000000-0000-4000-8000-${String(projectIndex + 1).padStart(12, "0")}`,
        tempoBpm: project.tempoBpm,
        timeSignature: project.timeSignature,
        musicalKey: project.musicalKey,
        ppq: 480,
        durationTicks: project.durationTicks,
        tracks: project.tracks.map((track, sortOrder) => ({
          trackId: track.trackId,
          sortOrder,
          name: track.name,
          presetId: track.presetId,
          presetVersion: 1,
          gainDb: track.gainDb,
          pan: track.pan,
          muted: false,
          soloed: false,
          clips: [
            {
              clipId: track.clipId,
              midiPatternVersionId: patternVersions.get(track.patternKey),
              startTick: 0,
              durationTicks: project.durationTicks,
              sourceStartTick: 0,
              loop: true,
            },
          ],
        })),
      });
      expect(parsed.tracks).toHaveLength(project.tracks.length);
    }
  });

  it("keeps the approachable challenge constraints deterministic", async () => {
    const challenge = release02BetaContent.challenge;
    const constraints = challengeConstraintsV1Schema.parse(
      challenge.constraints,
    );
    expect(await sha256PostgresJsonb(constraints)).toBe(
      challenge.expectedConstraintsSha256,
    );
    expect(constraints.trackCount).toEqual({
      minimum: 2,
      maximum: 4,
      exact: null,
    });
  });
});
