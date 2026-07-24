import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importStudioClipResultSchema } from "../clip-collection/schema";
import type { StudioClipDrawer } from "../clip-collection/studio-clip-drawer.client";
import {
  V3_IDS,
  V3_MANIFEST_BEFORE,
  V3_PATTERN_VERSION_1,
} from "../manifest/v3.fixtures";
import { MidiStudioSurface } from "./midi-studio-surface.client";
import {
  publishMidiWorkspaceV3Action,
  saveMidiWorkspaceV3Action,
} from "@/features/workspaces/actions";

const drawerState = vi.hoisted(() => ({
  props: null as null | Parameters<typeof StudioClipDrawer>[0],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../clip-collection/studio-clip-drawer.client", () => ({
  StudioClipDrawer: (props: Parameters<typeof StudioClipDrawer>[0]) => {
    drawerState.props = props;
    return props.open ? <div role="dialog">Clip drawer test double</div> : null;
  },
}));

vi.mock("@/features/workspaces/actions", () => ({
  saveMidiWorkspaceV3Action: vi.fn(),
  publishMidiWorkspaceV3Action: vi.fn(),
}));

vi.mock("./browser-midi-runtime.client", () => ({
  BrowserMidiRuntime: class {
    prepare = vi.fn().mockResolvedValue(undefined);
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    dispose = vi.fn();
    getTransportSnapshot = vi.fn().mockReturnValue({
      positionSeconds: 0,
      state: "paused",
    });
  },
}));

const importedPatternId = "40000000-0000-4000-8000-000000000901";
const importedVersionId = "40000000-0000-4000-8000-000000000902";
const importedTrackId = "40000000-0000-4000-8000-000000000903";
const importedClipId = "40000000-0000-4000-8000-000000000904";
const importedNoteId = "40000000-0000-4000-8000-000000000905";

const importResult = importStudioClipResultSchema.parse({
  source: {
    kind: "saved",
    savedListingId: "40000000-0000-4000-8000-000000000906",
    externalCredits: [],
  },
  projectId: V3_IDS.project,
  workspaceId: V3_IDS.workspace,
  contributionId: null,
  lockVersion: 8,
  manifestSha256: "f".repeat(64),
  manifest: {
    ...V3_MANIFEST_BEFORE,
    workspaceId: V3_IDS.workspace,
    tracks: [
      ...V3_MANIFEST_BEFORE.tracks,
      {
        trackId: importedTrackId,
        sortOrder: 2,
        name: "Imported pulse",
        presetId: "warm-keys",
        presetVersion: 1,
        gainDb: 0,
        pan: 0,
        muted: false,
        soloed: false,
        clips: [
          {
            clipId: importedClipId,
            midiPatternVersionId: importedVersionId,
            startTick: 960,
            durationTicks: 960,
            sourceStartTick: 0,
            loop: false,
          },
        ],
      },
    ],
  },
  trackId: importedTrackId,
  clipId: importedClipId,
  importedPattern: {
    midiPatternVersionId: importedVersionId,
    midiPatternId: importedPatternId,
    version: 3,
    creatorId: V3_IDS.creator,
    creatorCreditName: "Night collaborator",
    parentMidiPatternVersionId: null,
    sourceMidiPatternVersionId: null,
    contentSha256: "e".repeat(64),
    noteCount: 1,
    ppq: 480,
    durationTicks: 960,
    reuseLicense: {
      code: "CC-BY-4.0",
      version: "4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
    },
    createdAt: "2026-07-24T12:00:00.000Z",
    notes: [
      {
        noteId: importedNoteId,
        startTick: 0,
        durationTicks: 240,
        pitch: 64,
        velocity: 90,
      },
    ],
    name: "Imported pulse",
    presetId: "warm-keys",
    presetVersion: 1,
  },
});

beforeEach(() => {
  drawerState.props = null;
  vi.clearAllMocks();
  vi.mocked(saveMidiWorkspaceV3Action).mockResolvedValue({
    ok: true,
    lockVersion: 99,
    manifestSha256: "9".repeat(64),
    updatedAt: "2026-07-24T12:00:00.000Z",
  });
  vi.mocked(publishMidiWorkspaceV3Action).mockResolvedValue({
    ok: false,
    code: "unavailable",
  });
});

afterEach(cleanup);

describe("MidiStudioSurface clip import integration", () => {
  it("applies canonical manifest, playback pattern, hash and lock without reload or redundant autosave", async () => {
    render(
      <MidiStudioSurface
        mode="workspace"
        viewerId={V3_IDS.creator}
        projectId={V3_IDS.project}
        projectTitle="Canonical import session"
        workspaceId={V3_IDS.workspace}
        baseRevisionId={null}
        currentRevisionId={null}
        currentRevisionNumber={null}
        lockVersion={7}
        manifestSha256={"a".repeat(64)}
        updatedAt="2026-07-24T12:00:00.000Z"
        staleDraft={null}
        manifest={{ ...V3_MANIFEST_BEFORE, workspaceId: V3_IDS.workspace }}
        durationMs={4_000}
        tracks={V3_MANIFEST_BEFORE.tracks.map((track) => ({
          trackId: track.trackId,
          instrumentName: track.presetId,
          creditName: "Loop Maker",
        }))}
        patternVersions={[
          {
            ...V3_PATTERN_VERSION_1,
            name: "Warm keys",
            presetId: "warm-keys",
            presetVersion: 1,
          },
        ]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Library" }),
    ).not.toBeInTheDocument();
    screen.getByRole("button", { name: "Add from clips" }).click();
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Clip drawer test double",
    );

    act(() => {
      drawerState.props!.onImported(importResult);
    });

    expect(
      await screen.findByRole("button", {
        name: /Select track Imported pulse/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /MIDI clip on Imported pulse,.*Night collaborator/,
      }),
    ).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Imported pulse was added on a new track at the playhead.",
    );

    const authority = await drawerState.props!.prepareImport();
    expect(authority).toMatchObject({
      ok: true,
      workspaceId: V3_IDS.workspace,
      expectedWorkspaceLockVersion: 8,
    });
    expect(saveMidiWorkspaceV3Action).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 950));
    expect(saveMidiWorkspaceV3Action).not.toHaveBeenCalled();
  });
});
