# MIDI-03 Signal-derived piano roll and editing

Status: Complete in application/domain code; targeted local Chromium verification is environment-blocked as recorded below

## Implemented boundary

The standalone My stems editor now owns a viewport-rendered piano roll without adopting Signal runtime state, stores, routing, transport, or file authority. Signal remains the interaction reference pinned and attributed by MIDI-01. Canvas state is visual and transient; every committed edit becomes a Jam Session semantic command over canonical `MidiNoteV1` data.

The editor supports double-click and explicit note creation, single/multi-selection, snapped pointer move and resize, duplicate, delete, velocity, quantize, horizontal zoom, pitch/timeline scrolling, and a playback playhead. A synchronized native multi-select note list and exact pitch/start/duration/velocity inspector provide the semantic non-visual authority. Scoped shortcuts cover selection movement/resizing, duplicate, delete, select all, undo, and redo without intercepting text-entry controls.

Undo/redo retains at most 100 in-memory note snapshots and is never included in the draft payload. Preset changes preserve notes only when every pitch remains valid and reset transient history so Undo cannot restore content invalid for the selected preset.

## Persistence and recovery

Note commands, inspector edits, name changes, and preset changes debounce into the existing owner-authorized `save_midi_stem_draft` action. Autosave uses the server lock version, never overwrites a newer tab, waits at most five seconds from the first dirty edit, retries when connectivity returns, and blocks automatic conflict overwrite.

Pending/conflicted content is also written to a validated owner/draft-scoped browser recovery envelope. A reload may explicitly restore that content or retain the server draft; either choice still uses the existing runtime schema and optimistic server command before it becomes persisted authority. Successful server save clears the recovery copy.

## Limits and measurements

- The existing 2,048-note stem cap is enforced before note creation or duplication.
- Canvas rendering filters to visible tick/pitch rows while the semantic note list retains the canonical complete draft.
- The maximum-fixture test applies one 128-note selection move within 250 ms on the test runner and proves the complete 2,048-note JSON payload remains below 512 KiB.
- The editor displays its current estimated payload in KiB so growth is visible during composition.

## Verification

- Focused history, autosave, recovery, maximum-fixture, semantic-command, and stem-schema tests passed.
- Touched-file ESLint passed.
- TypeScript type checking passed during focused iteration.
- The named local Chromium journey was attempted through `npm run test:e2e:local -- tests/e2e/midi-stems.spec.ts`. After the prescribed local stack start/reset, it was blocked before application navigation because the current local Supabase Data API grants neither `service_role` nor `authenticated` table privileges on the existing `profiles` table. The fixture was corrected once to use the actor's normal authenticated RLS path, which exposed the same underlying missing table-grant condition. The two-attempt ceiling stopped further retries. No migration was added because this is pre-existing identity/Data API infrastructure outside MIDI-03.

## Deployment order and follow-up

MIDI-03 has no migration, generated database types, dependency, Storage object, hosted mutation, or capability change. Application code can deploy after MIDI-02 schema/application support. MIDI-04 is next and owns recording, Web MIDI permission/device behavior, immutable stem version publication, and Standard MIDI import/download.
