export type WebMidiNoteEvent = {
  type: "note-on" | "note-off";
  pitch: number;
  velocity: number;
  timestampMs: number;
};

type MidiMessageLike = { data: ArrayLike<number>; timeStamp: number };
type MidiInputLike = {
  name?: string | null;
  state?: string;
  onmidimessage: ((event: MidiMessageLike) => void) | null;
};
type MidiAccessLike = {
  inputs: { values(): IterableIterator<MidiInputLike> };
  onstatechange: ((event: { port?: MidiInputLike }) => void) | null;
};

export function parseWebMidiMessage(
  data: ArrayLike<number>,
  timestampMs: number,
): WebMidiNoteEvent | null {
  if (data.length < 3 || !Number.isFinite(timestampMs)) return null;
  const status = Number(data[0]);
  const pitch = Number(data[1]);
  const velocity = Number(data[2]);
  if (
    !Number.isInteger(status) ||
    !Number.isInteger(pitch) ||
    !Number.isInteger(velocity) ||
    pitch < 0 ||
    pitch > 127 ||
    velocity < 0 ||
    velocity > 127
  ) {
    return null;
  }
  const message = status & 0xf0;
  if (message === 0x90 && velocity > 0) {
    return { type: "note-on", pitch, velocity, timestampMs };
  }
  if (message === 0x80 || (message === 0x90 && velocity === 0)) {
    return { type: "note-off", pitch, velocity, timestampMs };
  }
  return null;
}

export async function requestWebMidiSession(input: {
  onNote: (event: WebMidiNoteEvent) => void;
  onDisconnect: () => void;
}) {
  const requestMidiAccess = (
    navigator as Navigator & {
      requestMIDIAccess?: (options: {
        sysex: false;
      }) => Promise<MidiAccessLike>;
    }
  ).requestMIDIAccess;
  if (!window.isSecureContext || typeof requestMidiAccess !== "function") {
    throw new Error("web_midi_unavailable");
  }
  const access = await requestMidiAccess.call(navigator, { sysex: false });
  const attached = new Set<MidiInputLike>();
  const attach = (port: MidiInputLike) => {
    if (port.state === "disconnected" || attached.has(port)) return;
    port.onmidimessage = (message) => {
      const parsed = parseWebMidiMessage(message.data, message.timeStamp);
      if (parsed) input.onNote(parsed);
    };
    attached.add(port);
  };
  for (const port of access.inputs.values()) attach(port);
  access.onstatechange = (event) => {
    const port = event.port;
    if (!port) return;
    if (port.state === "disconnected") {
      port.onmidimessage = null;
      attached.delete(port);
      input.onDisconnect();
    } else {
      attach(port);
    }
  };
  return {
    inputCount: attached.size,
    dispose() {
      access.onstatechange = null;
      for (const port of attached) port.onmidimessage = null;
      attached.clear();
    },
  };
}
