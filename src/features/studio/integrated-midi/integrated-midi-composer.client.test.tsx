import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MidiStemEditorHost } from "@/features/midi/stems/stem-editor.client";
import type {
  MidiStemDraft,
  MidiStemVersion,
} from "@/features/midi/stems/types";
import {
  IntegratedMidiComposer,
  type FinalizePatternInput,
} from "./integrated-midi-composer.client";
import {
  midiEditorDeviceDraftKey,
  type MidiEditorDraftTarget,
} from "./midi-editor-device-draft.client";

const editor = vi.hoisted(() => ({
  hosts: [] as MidiStemEditorHost[],
  drafts: [] as MidiStemDraft[],
}));

vi.mock("@/features/midi/stems/stem-editor.client", () => ({
  MidiStemEditor: ({
    draft,
    host,
  }: {
    draft: MidiStemDraft;
    host: MidiStemEditorHost;
  }) => {
    editor.hosts.push(host);
    editor.drafts.push(draft);
    return <div>Pattern editor</div>;
  },
}));
vi.mock("../manifest/canonical-json", () => ({
  sha256PostgresJsonb: vi.fn(async () => "a".repeat(64)),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  editor.hosts = [];
  editor.drafts = [];
});

const clipVersion: MidiStemVersion = {
  stemVersionId: "50000000-0000-4000-8000-000000000001",
  stemId: "50000000-0000-4000-8000-000000000002",
  version: 7,
  name: "Night keys",
  noteCount: 1,
  durationTicks: 1_920,
  defaultPresetId: "warm-keys",
  defaultPresetVersion: 1,
  parentStemVersionId: null,
  creatorCreditName: "Creator",
  creatorId: "20000000-0000-4000-8000-000000000123",
  ppq: 480,
  notes: [
    {
      noteId: "50000000-0000-4000-8000-000000000003",
      startTick: 0,
      durationTicks: 240,
      pitch: 60,
      velocity: 96,
    },
  ],
  contentSha256: "a".repeat(64),
  createdAt: "2026-07-24T12:00:00.000Z",
};

const clipTarget = {
  operation: "replace" as const,
  trackId: "10000000-0000-4000-8000-000000000123",
  clipId: "10000000-0000-4000-8000-000000000124",
  name: "Night keys",
  version: clipVersion,
  startTick: 480,
};

const baseProps = {
  target: clipTarget,
  ownerId: "20000000-0000-4000-8000-000000000123",
  projectId: "30000000-0000-4000-8000-000000000123",
  workspaceId: "40000000-0000-4000-8000-000000000123",
  tempoBpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  onClose: vi.fn(),
  onDiscard: vi.fn(),
  onTransportStart: vi.fn(),
  onTransportStop: vi.fn(),
  onFinalize: vi.fn(async () => ({ ok: true, message: "Applied" })),
  onDraftStatusChange: vi.fn(),
  onDraftOpened: vi.fn(),
};

describe("IntegratedMidiComposer", () => {
  it("keeps the editor host stable when parent callbacks change", async () => {
    const target = {
      operation: "add" as const,
      startTick: 480,
      trackId: "10000000-0000-4000-8000-000000000123",
      name: "New pattern",
      entry: "blank" as const,
    };
    const onDraftOpened = vi.fn();
    const baseProps = {
      target,
      ownerId: "20000000-0000-4000-8000-000000000123",
      projectId: "30000000-0000-4000-8000-000000000123",
      workspaceId: "40000000-0000-4000-8000-000000000123",
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      onDiscard: vi.fn(),
      onTransportStart: vi.fn(),
      onTransportStop: vi.fn(),
      onFinalize: vi.fn(async () => ({ ok: true, message: "Saved" })),
      onDraftStatusChange: vi.fn(),
      onDraftOpened,
    };
    const view = render(
      <IntegratedMidiComposer {...baseProps} onClose={() => {}} />,
    );
    await waitFor(() => expect(editor.hosts.length).toBeGreaterThan(0));
    const initialHost = editor.hosts.at(-1);

    view.rerender(
      <IntegratedMidiComposer
        {...baseProps}
        onClose={() => {}}
        onTransportStart={() => {}}
        onDraftOpened={() => onDraftOpened()}
      />,
    );

    await waitFor(() => expect(editor.hosts.at(-1)).toBe(initialHost));
    expect(onDraftOpened).toHaveBeenCalledOnce();
  });

  it("overwrites and restores one stable device record across remounts", async () => {
    const view = render(<IntegratedMidiComposer {...baseProps} />);
    await waitFor(() => expect(editor.hosts.length).toBeGreaterThan(0));
    const changedNotes = [
      ...clipVersion.notes,
      {
        noteId: "50000000-0000-4000-8000-000000000004",
        startTick: 480,
        durationTicks: 240,
        pitch: 64,
        velocity: 90,
      },
    ];
    expect(
      await editor.hosts.at(-1)!.persistDraft!({
        name: "Recovered keys",
        defaultPresetId: "soft-lead",
        defaultPresetVersion: 1,
        ppq: 480,
        durationTicks: 1_920,
        notes: changedNotes,
      }),
    ).toMatchObject({ ok: true, lockVersion: 2 });
    const deviceTarget: MidiEditorDraftTarget = {
      kind: "clip",
      viewerId: baseProps.ownerId,
      projectId: baseProps.projectId,
      workspaceId: baseProps.workspaceId,
      trackId: clipTarget.trackId,
      clipId: clipTarget.clipId,
      basePatternVersionId: clipVersion.stemVersionId,
      baseContentSha256: clipVersion.contentSha256,
      baseVersionNumber: clipVersion.version,
    };
    expect(
      localStorage.getItem(midiEditorDeviceDraftKey(deviceTarget)),
    ).toEqual(expect.any(String));

    view.unmount();
    render(<IntegratedMidiComposer {...baseProps} />);
    await waitFor(() =>
      expect(editor.drafts.at(-1)?.name).toBe("Recovered keys"),
    );
    expect(editor.drafts.at(-1)).toMatchObject({
      defaultPresetId: "soft-lead",
      notes: changedNotes,
    });
    expect(
      screen.getByText("Device draft restored · based on pattern version 7"),
    ).toBeVisible();
  });

  it("replays one apply identity after a same-content autosave and remount", async () => {
    const freezePattern = vi.fn(
      async (input: {
        patternRequestId: string | null;
        versionRequestId: string | null;
        trackId: string;
        clipId: string;
      }) => input,
    );
    let saveAttempts = 0;
    const onFinalize = vi.fn(async (input: FinalizePatternInput) => {
      await freezePattern({
        patternRequestId: input.patternRequestId,
        versionRequestId: input.versionRequestId,
        trackId: input.appliedTrackId,
        clipId: input.appliedClipId,
      });
      saveAttempts += 1;
      return saveAttempts === 1
        ? { ok: false as const, message: "Workspace failed" }
        : { ok: true as const, message: "Applied" };
    });
    const target = {
      ...clipTarget,
      version: { ...clipVersion, contentSha256: "b".repeat(64) },
    };
    const view = render(
      <IntegratedMidiComposer
        {...baseProps}
        target={target}
        onFinalize={onFinalize}
      />,
    );
    await waitFor(() => expect(editor.hosts.length).toBeGreaterThan(0));
    const host = editor.hosts.at(-1)!;
    await host.persistDraft!({
      name: clipVersion.name,
      defaultPresetId: clipVersion.defaultPresetId,
      defaultPresetVersion: 1,
      ppq: 480,
      durationTicks: clipVersion.durationTicks,
      notes: clipVersion.notes,
    });
    const input = {
      draftId: editor.drafts.at(-1)!.draftId,
      expectedLockVersion: 2,
      expectedContentSha256: "a".repeat(64),
      content: {
        name: clipVersion.name,
        presetId: clipVersion.defaultPresetId,
        presetVersion: 1 as const,
        ppq: 480 as const,
        durationTicks: clipVersion.durationTicks,
        notes: clipVersion.notes,
      },
    };
    expect(await host.finalize(input)).toEqual({
      ok: false,
      message: "Workspace failed",
    });
    const firstIntent = onFinalize.mock.calls[0]![0];
    expect(firstIntent.patternRequestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(localStorage.length).toBeGreaterThan(0);

    expect(
      await host.persistDraft!({
        name: clipVersion.name,
        defaultPresetId: clipVersion.defaultPresetId,
        defaultPresetVersion: 1,
        ppq: 480,
        durationTicks: clipVersion.durationTicks,
        notes: clipVersion.notes,
      }),
    ).toMatchObject({ ok: true });
    view.unmount();

    const hostCount = editor.hosts.length;
    render(
      <IntegratedMidiComposer
        {...baseProps}
        target={target}
        onFinalize={onFinalize}
      />,
    );
    await waitFor(() => expect(editor.hosts.length).toBeGreaterThan(hostCount));
    const reopenedHost = editor.hosts.at(-1)!;
    expect(await reopenedHost.finalize(input)).toEqual({
      ok: true,
      message: "Applied",
    });
    expect(onFinalize.mock.calls[1]![0]).toMatchObject({
      patternRequestId: firstIntent.patternRequestId,
      versionRequestId: firstIntent.versionRequestId,
      appliedTrackId: firstIntent.appliedTrackId,
      appliedClipId: firstIntent.appliedClipId,
    });
    expect(freezePattern).toHaveBeenCalledTimes(2);
    expect(freezePattern.mock.calls[1]![0]).toEqual(
      freezePattern.mock.calls[0]![0],
    );
    expect(localStorage.length).toBe(0);
  });

  it("confirms destructive discard in a focus-contained reduced-motion-safe dialog", async () => {
    const view = render(<IntegratedMidiComposer {...baseProps} />);
    await screen.findByText("Pattern editor");
    view.unmount();
    render(<IntegratedMidiComposer {...baseProps} />);
    await screen.findByText(
      "Device draft restored · based on pattern version 7",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Discard device draft" }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Discard this device draft?",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
