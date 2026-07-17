import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MidiStemEditorHost } from "@/features/midi/stems/stem-editor.client";
import { IntegratedMidiComposer } from "./integrated-midi-composer.client";

const editor = vi.hoisted(() => ({
  hosts: [] as MidiStemEditorHost[],
}));

vi.mock("@/features/midi/stems/stem-editor.client", () => ({
  MidiStemEditor: ({ host }: { host: MidiStemEditorHost }) => {
    editor.hosts.push(host);
    return <div>Pattern editor</div>;
  },
}));
vi.mock("../manifest/canonical-json", () => ({
  sha256PostgresJsonb: vi.fn(async () => "a".repeat(64)),
}));

afterEach(() => {
  cleanup();
  editor.hosts = [];
});

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
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
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
});
