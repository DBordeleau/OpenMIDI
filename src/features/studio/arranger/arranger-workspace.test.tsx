import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseWorkspaceManifestV2 } from "../manifest/v2";
import { ArrangerWorkspace } from "./arranger-workspace";

const uuid = (suffix: number) =>
  `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

afterEach(cleanup);

describe("ArrangerWorkspace", () => {
  it("seeks to exact ruler coordinates instead of restricting the playhead to bars", () => {
    const onSeek = vi.fn();
    const onOpenPendingPianoRoll = vi.fn();
    const onPendingMidiLaneNameChange = vi.fn();
    const manifest = parseWorkspaceManifestV2({
      manifestVersion: 2,
      engine: "jam-session-composite",
      engineVersion: "jam-session-composite-2_tone-15.1.22",
      projectId: uuid(1),
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      durationTicks: 2_880,
      tracks: [],
    });
    render(
      <ArrangerWorkspace
        manifest={manifest}
        midiVersions={[]}
        trackCredits={[]}
        editable
        playing={false}
        playheadTick={0}
        onTogglePlayback={vi.fn()}
        onSeek={onSeek}
        onTrackPatch={vi.fn()}
        onClipPatch={vi.fn()}
        onMoveTrack={vi.fn()}
        onRemoveTrack={vi.fn()}
        onReplaceVersion={vi.fn()}
        onEditMidiClip={vi.fn()}
        onCommand={vi.fn()}
        pendingMidiLane={{ trackId: uuid(20), name: "Verse keys" }}
        onAddMidiLane={vi.fn()}
        onPendingMidiLaneNameChange={onPendingMidiLaneNameChange}
        onOpenPendingPianoRoll={onOpenPendingPianoRoll}
        onImportPendingMidi={vi.fn()}
        onClosePendingMidiLane={vi.fn()}
        finalizedClip={null}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        actionRegion={null}
        statusRegion={null}
      />,
    );

    const ruler = screen.getByRole("slider", {
      name: "Arrangement playhead",
    });
    Object.defineProperties(ruler, {
      getBoundingClientRect: {
        value: () => ({ left: 100, width: 720 }),
      },
      setPointerCapture: { value: vi.fn() },
    });
    fireEvent.pointerDown(ruler, {
      button: 0,
      pointerId: 7,
      clientX: 148,
    });

    expect(onSeek).toHaveBeenCalledWith(240);
    expect(screen.getByLabelText("Pending track name")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Pending track name"), {
      target: { value: "Chorus keys" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Open piano roll" }));
    expect(onPendingMidiLaneNameChange).toHaveBeenCalledWith("Chorus keys");
    expect(onOpenPendingPianoRoll).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Add a track" })).toBeDisabled();
  });

  it("renders all clips, exposes selection summaries, and keeps read-only mixer controls denied", () => {
    const versionId = uuid(8);
    const manifest = parseWorkspaceManifestV2({
      manifestVersion: 2,
      engine: "jam-session-composite",
      engineVersion: "jam-session-composite-2_tone-15.1.22",
      projectId: uuid(1),
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      durationTicks: 2_880,
      tracks: [
        {
          kind: "midi",
          trackId: uuid(2),
          name: "Keys",
          instrumentId: null,
          presetId: "warm-poly-v1",
          presetVersion: 1,
          gainDb: 0,
          pan: 0,
          muted: false,
          soloed: false,
          sortOrder: 0,
          clips: [
            {
              clipId: uuid(3),
              midiStemVersionId: versionId,
              startTick: 0,
              durationTicks: 480,
              sourceStartTick: 0,
              loop: false,
            },
            {
              clipId: uuid(4),
              midiStemVersionId: versionId,
              startTick: 960,
              durationTicks: 480,
              sourceStartTick: 0,
              loop: false,
            },
          ],
        },
      ],
    });
    render(
      <ArrangerWorkspace
        manifest={manifest}
        midiVersions={[
          {
            stemVersionId: versionId,
            stemId: uuid(9),
            version: 1,
            name: "Keys take",
            noteCount: 1,
            durationTicks: 480,
            defaultPresetId: "warm-poly-v1",
            defaultPresetVersion: 1,
            parentStemVersionId: null,
            creatorCreditName: "Ada",
            createdAt: "2026-07-15T00:00:00.000Z",
            creatorId: uuid(10),
            ppq: 480,
            notes: [
              {
                noteId: uuid(11),
                pitch: 64,
                velocity: 100,
                startTick: 0,
                durationTicks: 240,
              },
            ],
            contentSha256: "a".repeat(64),
          },
        ]}
        trackCredits={[
          { trackId: uuid(2), instrumentName: null, creditName: "Ada" },
        ]}
        editable={false}
        playing={false}
        playheadTick={0}
        onTogglePlayback={vi.fn()}
        onSeek={vi.fn()}
        onTrackPatch={vi.fn()}
        onClipPatch={vi.fn()}
        onMoveTrack={vi.fn()}
        onRemoveTrack={vi.fn()}
        onReplaceVersion={vi.fn()}
        onEditMidiClip={vi.fn()}
        onCommand={vi.fn()}
        pendingMidiLane={null}
        onAddMidiLane={vi.fn()}
        onPendingMidiLaneNameChange={vi.fn()}
        onOpenPendingPianoRoll={vi.fn()}
        onImportPendingMidi={vi.fn()}
        onClosePendingMidiLane={vi.fn()}
        finalizedClip={null}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        actionRegion={<button type="button">Actions</button>}
        statusRegion={<span>Read only</span>}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Arrangement workspace" }),
    ).toBeVisible();
    const clips = screen.getAllByRole("button", { name: /MIDI clip on Keys/ });
    expect(clips).toHaveLength(2);
    fireEvent.contextMenu(clips[1]!);
    expect(
      screen.getByRole("dialog", { name: "Clip options" }),
    ).toHaveTextContent("Keys clip");
    expect(screen.getByLabelText("Start tick")).toHaveValue(960);
    expect(screen.getByRole("button", { name: "Mute Keys" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Keys down" }),
    ).toBeDisabled();
  });

  it("opens the selected MIDI clip from Enter and double-click", () => {
    const onEditMidiClip = vi.fn();
    const onCommand = vi.fn(() => true);
    const versionId = uuid(8);
    const manifest = parseWorkspaceManifestV2({
      manifestVersion: 2,
      engine: "jam-session-composite",
      engineVersion: "jam-session-composite-2_tone-15.1.22",
      projectId: uuid(1),
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      durationTicks: 960,
      tracks: [
        {
          kind: "midi",
          trackId: uuid(2),
          name: "Keys",
          instrumentId: null,
          presetId: "warm-poly-v1",
          presetVersion: 1,
          gainDb: 0,
          pan: 0,
          muted: false,
          soloed: false,
          sortOrder: 0,
          clips: [
            {
              clipId: uuid(3),
              midiStemVersionId: versionId,
              startTick: 0,
              durationTicks: 480,
              sourceStartTick: 0,
              loop: false,
            },
          ],
        },
      ],
    });
    const version = {
      stemVersionId: versionId,
      stemId: uuid(9),
      version: 1,
      name: "Keys take",
      noteCount: 0,
      durationTicks: 480,
      defaultPresetId: "warm-poly-v1",
      defaultPresetVersion: 1,
      parentStemVersionId: null,
      creatorCreditName: "Ada",
      createdAt: "2026-07-15T00:00:00.000Z",
      creatorId: uuid(10),
      ppq: 480 as const,
      notes: [],
      contentSha256: "a".repeat(64),
    };
    const view = render(
      <ArrangerWorkspace
        manifest={manifest}
        midiVersions={[version]}
        trackCredits={[]}
        editable
        playing={false}
        playheadTick={0}
        onTogglePlayback={vi.fn()}
        onSeek={vi.fn()}
        onTrackPatch={vi.fn()}
        onClipPatch={vi.fn()}
        onMoveTrack={vi.fn()}
        onRemoveTrack={vi.fn()}
        onReplaceVersion={vi.fn()}
        onEditMidiClip={onEditMidiClip}
        onCommand={onCommand}
        pendingMidiLane={null}
        onAddMidiLane={vi.fn()}
        onPendingMidiLaneNameChange={vi.fn()}
        onOpenPendingPianoRoll={vi.fn()}
        onImportPendingMidi={vi.fn()}
        onClosePendingMidiLane={vi.fn()}
        finalizedClip={null}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        actionRegion={null}
        statusRegion={null}
      />,
    );
    const scoped = within(view.container);
    fireEvent.click(scoped.getByRole("button", { name: "Duplicate Keys" }));
    expect(onCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "duplicateMidiTrack",
        trackId: uuid(2),
        newClipIds: [expect.any(String)],
      }),
    );
    const clip = scoped.getByRole("button", { name: /MIDI clip on Keys/ });
    fireEvent.click(clip);
    fireEvent.keyDown(
      scoped.getByRole("region", { name: "Arrangement workspace" }),
      { key: "Enter" },
    );
    fireEvent.doubleClick(clip);
    expect(onEditMidiClip).toHaveBeenNthCalledWith(1, uuid(2), uuid(3));
    expect(onEditMidiClip).toHaveBeenNthCalledWith(2, uuid(2), uuid(3));
  });
});
