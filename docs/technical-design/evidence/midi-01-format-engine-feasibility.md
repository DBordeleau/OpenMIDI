# MIDI-01 format and engine feasibility

Status: Complete; executable contracts are frozen for MIDI-02–MIDI-06, with no production schema or route migration

## Accepted boundary

MIDI-01 adds candidate contracts and evidence only. Production manifest-v1 parsing, immutable history, current Studio routes, source-audio admission, and Supabase data remain unchanged. The `/midi-feasibility` route returns not found in production and exists only to exercise the client boundary during development and tests.

The frozen ownership split is:

- canonical MIDI notes and stem lineage are Jam Session domain data, never Tone.js or Signal state;
- standalone stem editing emits semantic `add`, `move`, `resize`, `velocity`, `duplicate`, `quantize`, and `delete` commands;
- project manifests reference exact immutable stem-version and preset-version IDs;
- the composite controller owns transport, seek/loop coordination, mixer projection, all-notes-off, and idempotent disposal;
- Waveform Playlist remains the legacy-audio runtime through an explicit port, while MIDI scheduling and synthesis remain browser-only;
- a server resolver will produce the route-neutral session descriptor in MIDI-05; clients receive explicit capabilities and canonical links rather than inferring authority from IDs or route shape.

## Frozen format limits

| Contract                 | MIDI-01 decision                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Timing                   | 480 PPQ; MIDI tempo from 20–300 BPM; audio-only legacy mappings preserve v1 through 400 BPM              |
| Duration                 | 10-minute project/stem ceiling                                                                           |
| Track counts             | 16 MIDI and 12 legacy-audio tracks                                                                       |
| Clip counts              | 32 stable clip references per track                                                                      |
| Note counts              | 2,048 per stem version; 16,384 resolved per project schedule                                             |
| Notes                    | pitch 0–127, velocity 1–127, non-negative integer start tick, positive integer duration                  |
| Voice budget             | 32 simultaneous project voices with deterministic runtime allocation; preset-local caps are 4 or 8       |
| Quantization             | 1/4, 1/8, 1/16, and 1/32; no triplets                                                                    |
| Prototype library bounds | 100 mutable drafts and 500 immutable versions per owner, to be enforced with the MIDI-02 schema/commands |

Tick zero is intentionally valid. The plan's proposed “positive start tick” wording was adjusted to non-negative because the first beat is tick zero; durations remain strictly positive. A manifest-v2 audio track retains exactly one immutable `assetId`, owns non-overlapping stable clips, and preserves the current attribution/retention boundary. The deterministic v1→v2 mapping uses each unique v1 track ID as its initial single clip ID and maps the historical v1 `workspaceId` field to the correctly named v2 `projectId`.

Stem content checksums cover canonical name, exact preset version, PPQ, duration, and notes ordered by start/pitch/ID. Identity, version, creator, and optional parent-version lineage remain relational envelope fields. Project manifests order tracks by contiguous `sortOrder` and clips by position/tick then ID.

## Studio session and runtime contract

`StudioSessionDescriptor` now has executable schemas for empty Studio, owner workspace, contribution workspace, member revision, and contribution-version review. Every non-empty descriptor contains project compatibility, a v1 or v2 manifest, exact mutable/immutable authority, the six accepted capability flags, and application-relative canonical links. The descriptor is independent of the current nested route.

`CompositeStudioController`, `LegacyAudioRuntimePort`, and `MidiRuntimePort` freeze responsibilities without introducing a second production runtime. Disposal first calls MIDI all-notes-off and then disposes both graphs exactly once, even when callers race or repeat disposal.

## Signal review and attribution

Reviewed upstream: `ryohey/signal` commit `632de9685990c90d0be127994908cc43692ff82a` from 2026-05-22, MIT licensed.

Candidate behavioral references were limited to:

- `app/src/hooks/usePianoRollDraggable.ts` for center/edge drag vocabulary and bounded selection movement;
- `app/src/components/PianoRoll/MouseHandler/gestures/*` for create/select/move/resize gesture decomposition;
- `app/src/actions/track.ts` and `app/src/actions/selection.ts` for note-command and quantize interaction vocabulary;
- `app/src/entities/transform/NoteCoordTransform.ts` and related tick/key transforms for pixel↔musical-coordinate separation;
- the visible piano-roll, keyboard-shortcut, velocity-control, and selection components as interaction references.

No upstream source was copied. Jam Session's reducer, UUID note identity, schemas, canvas spike, note inspector, React state, accessibility model, and tests are original and domain-owned. Signal's MobX stores, Firebase/API packages, autosave authority, player/transport, SoundFont and SpessaSynth paths, WebGL state, song format, Electron code, icons, fonts, cursors, and `.sf2` assets are explicitly excluded. The upstream notice is preserved in `docs/third-party/signal-LICENSE.txt` and `THIRD_PARTY_NOTICES.md`.

## Standard MIDI File decision

Adopt exactly pinned `@tonejs/midi` 2.0.28 behind `interchange.client.ts` for MIDI-04 import/download. It is MIT licensed, has a 287,668-byte unpacked npm distribution, and locks `midi-file` 1.2.4 plus `array-flatten` 3.0.0. The wrapper, rather than the library, enforces one MiB input, 2,048 notes, 10 minutes, 20–300 BPM, one tempo/time signature, normalized 480 PPQ, supported note/velocity ranges, deterministic ordering, malformed-input errors, and explicit warnings for ignored controller/pitch-bend events.

`midi-file` 1.2.4 was the smaller 47,239-byte alternative but exposes raw events and would require more pairing/canonicalization code. `midi-writer-js` 3.2.1 was active and MIT licensed but is writer-focused, larger (334,300 bytes unpacked), and would still require a separate parser. The chosen package provides one bounded read/write surface and deterministic byte output; it remains lazy and client-only. Its upstream release cadence is old, so upgrades or replacement require the existing round-trip/malformed fixtures rather than an automatic range update.

## Preset v1 and browser measurements

Preset v1 freezes six melodic graphs—Warm Poly, Glass Keys, Round Bass, Soft Pad, Bright Lead, and Air Pluck—plus Studio Drums. Every definition fixes oscillator, ADSR, low-pass filter, effect wet levels, gain compensation, note range, and local polyphony. There are no samples, SoundFonts, remote requests, or arbitrary stored synth graphs. All voices route through a −3 dB limiter and fixed −6 dB post-limiter safety stage and expose all-notes-off plus idempotent disposal.

`npm run midi:benchmark` ran five fresh Chromium contexts on the supported desktop profile. Results separate route-to-harness readiness, lazy module loading, audio-context/synth readiness, scheduling, offline preset rendering, and peak output.

| Measurement                                  |   Median |  Slowest |
| -------------------------------------------- | -------: | -------: |
| Route to harness ready                       | 712.4 ms | 858.2 ms |
| Lazy Tone module portion                     |  17.4 ms |  30.2 ms |
| Gesture to resumed context + Warm Poly ready | 180.4 ms | 237.4 ms |
| 8 tracks / 2,000 scheduled notes             |   7.0 ms |   7.1 ms |
| 16 tracks / 16,384 scheduled notes           |   3.7 ms |   5.6 ms |

| Dense preset render    |   Median |  Slowest | Peak across runs |
| ---------------------- | -------: | -------: | ---------------: |
| Warm Poly, 8 voices    | 195.6 ms | 211.2 ms |        −6.7 dBFS |
| Glass Keys, 8 voices   | 180.2 ms | 189.7 ms |        −0.7 dBFS |
| Round Bass, 4 voices   | 142.9 ms | 145.2 ms |        −8.2 dBFS |
| Soft Pad, 8 voices     | 166.9 ms | 176.6 ms |       −19.0 dBFS |
| Bright Lead, 4 voices  | 141.7 ms | 145.3 ms |       −12.1 dBFS |
| Air Pluck, 8 voices    | 159.4 ms | 161.8 ms |        −0.5 dBFS |
| Studio Drums, 8 voices | 148.7 ms | 155.4 ms |        −1.9 dBFS |

The first measurement pass exposed peaks above full scale despite the limiter. The accepted v1 graph therefore includes the post-limiter safety stage; the table records the corrected five-run result. All runs had zero captured console errors. The scheduler's maximum case is intentionally faster than the 2,000-note case in some runs because timing granularity is sub-millisecond and JIT warmup varies; both are far inside the two-second schedule-readiness target.

## Accessibility and browser fallback

The 2,000-note spike renders its visual overview on a non-authoritative canvas and exposes selected note, pitch, start tick, and velocity through labeled native controls. The same semantic reducer owns pointer/keyboard/note-inspector changes. Web MIDI detection requires a secure context and a callable API, does not invoke `requestMIDIAccess`, and never blocks the manual path. Unit tests cover absent and insecure-context fallbacks, which are the Firefox/Safari structural path; Chromium automated coverage also represents current Edge's engine behavior. No hardware identity is read or persisted.

Chrome/Chromium passed automated scheduling, accessible editing, lazy audio resume, all-preset offline rendering, and no-console-error checks. Hardware MIDI, Firefox audio output, Safari audio output, and perceived sound quality remain manual MIDI-04 matrix items because those browsers/devices are unavailable in this Windows environment.

## Verification

- Focused MIDI/manifest/session/controller unit tests: passed.
- `npm run typecheck`: passed during focused iteration.
- `npm run midi:benchmark`: five corrected Chromium runs passed with zero console errors.
- `npm run test:e2e:local -- tests/e2e/midi-feasibility.spec.ts`: passed after one selector-only harness correction.
- `npm run check`: passed after final stabilization (format, lint, typecheck, 145 tests, and production build).
- Production audit: `/midi-feasibility` returned HTTP 404 and rebuilt server chunks contained no Tone/SMF implementation.
- `git diff --check`, dependency/notice, secret, fixture, and production bundle review: passed.

## Deployment and next slice

There is no migration, generated database type, hosted mutation, capability enablement, or audio-admission change. Deploying the application is optional because the harness is production-inaccessible; if deployed, the production build must continue to keep Tone.js and `@tonejs/midi` out of server chunks and ordinary route entrypoints. MIDI-02 may now add owner-scoped draft persistence and library UI using these exact contracts and limits. MIDI-05 remains responsible for the production resolver, composite runtime, relational clip projections, and atomic project-plus-empty-workspace command.
