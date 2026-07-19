# MIDI-04 recording and interchange checks

Status: implementation evidence complete; physical-device/browser matrix remains a release manual check

## Implemented boundary

- On-screen piano and A–K QWERTY input share one OpenMIDI note-on/off path with octave and default-velocity controls.
- Recording uses a fixed 120 BPM standalone transport, optional one-bar count-in, an audio-clock-scheduled metronome, and a visible tick playhead. Stopping, focus loss, hidden-tab state, audio suspension, hardware disconnect, and route disposal close open notes and release synth voices.
- One stopped take enters editor history as one semantic command. Recorded timing is not automatically quantized.
- Web MIDI is capability-detected and requested only by the **Connect hardware MIDI** gesture with `{ sysex: false }`. Only note-on/off messages cross the adapter. Device identifiers and names are not persisted or logged.
- Standard MIDI files are capped at 1 MiB and 2,048 notes, parsed in the browser, normalized to 480 PPQ, and reduced to supported note/name/tempo/velocity data. Controller, pitch-bend, program, multi-track merge, extra track-name, and non-4/4 metadata decisions are summarized before draft creation. Original bytes are never uploaded or stored.
- Individual immutable versions are fetched through owner RLS, then encoded and downloaded in the browser with exact notes, velocity, 480 PPQ, 120 BPM initialization, track name, 4/4 signature, and creator attribution metadata.

## Timestamp model

`MIDIMessageEvent.timeStamp`, pointer/QWERTY input timestamps, and `performance.now()` are monotonic `DOMHighResTimeStamp` values relative to the page performance time origin. Recording captures the planned transport start in that same domain and converts an event with:

`round(max(0, eventTimestamp - transportStart) / 1000 * BPM * PPQ / 60)`

The result is bounded to the stem duration. Tone's audio clock is used separately to schedule the count-in/metronome and audition voices; it is not converted through wall-clock time. Hardware/browser input latency remains observable raw timing and is never hidden by automatic quantization.

## Automated evidence

- Pure tests cover timestamp-to-tick conversion, hardware velocity, repeated note-on handling, positive note duration, and closing open notes on stop.
- Web MIDI parser tests cover channel note-on/off, velocity-zero note-off, malformed bytes, controller rejection, and SysEx rejection.
- Interchange tests cover deterministic encoding, bounded parsing, canonical note round trip, malformed/oversized rejection, and independent MIDI chunk/event inspection.
- pgTAP covers exact-lock/checksum publication, idempotency, append-only version numbering, creator snapshot, RLS, direct-write denial, suspended/anonymous denial, and immutable history.

## Manual release matrix

These checks require real browser permission UI or physical hardware and were not executed in the coding environment:

| Check                                            | Chrome/Edge secure context | Firefox              | Safari               | Expected result                                            |
| ------------------------------------------------ | -------------------------- | -------------------- | -------------------- | ---------------------------------------------------------- |
| On-screen/QWERTY record, count-in, stop, undo    | Required                   | Required             | Required             | One raw-timing take; no stuck notes                        |
| Web MIDI permission denied                       | Required                   | Unsupported fallback | Unsupported fallback | Manual inputs remain complete; no repeated prompt          |
| Hardware velocity and timing                     | One physical keyboard      | If API available     | If API available     | Velocity 1–127 retained; timing remains unquantized        |
| Disconnect during held note                      | Required                   | If API available     | If API available     | Recording stops, note closes, voices release               |
| Window blur/hidden tab during take               | Required                   | Required             | Required             | Recording stops safely and commits bounded notes           |
| Suspend/resume browser audio                     | Required                   | Required             | Required             | Take stops on suspension; next gesture can resume          |
| Import warning review and `.mid` download reopen | Required                   | Required             | Required             | No upload; exported note/name/velocity/credit data reopens |

For the hardware latency sample, record at least 20 evenly spaced notes against the click and report browser, OS, device, connection type, median offset, slowest absolute offset, and any main-thread long task. Do not record or publish device identifiers.
