# STUDIO-06 parity and hardening evidence

Date: 2026-07-15  
Scope: repository and local Supabase/Chromium evidence only  
Hosted source admission: enabled; no hosted mutation authorized

## Accepted repository outcome

The canonical Studio now covers project creation, MIDI track creation/import/derivation, piano-roll drawing and recording against project transport, immutable finalize-and-add/replace, arrangement and mix persistence, reload, publication, preview, contribution review/acceptance, copy-on-write fork, and Standard MIDI export. Standalone My stems/editor and manifest-v1 legacy-audio routes remain supported.

Hardening in this slice keeps lifecycle registration optional on alternate read-only Studio surfaces, loads every exact MIDI stem version referenced by authorized revision/contribution manifests through existing RLS, makes reservation mutation rely on the atomic database gate rather than a stale UI preflight, and exercises repeated serial project switching. The repository review also replaced the owner library's per-version request fan-out with one bounded query and batches exact-reference lookups so the documented manifest ceiling cannot create an oversized request URL.

## Automated evidence

- Focused unit coverage proves capability-read failures fail closed, stale clients surface `audio_uploads_unavailable`, and alternate Studio surfaces render without the canonical shell provider.
- Local database reset and `db:check` apply all migrations, run RLS/transaction tests (30 files, 718 assertions), lint the schema, and confirm generated-type parity.
- Local Chromium coverage exercises canonical/deep-link Studio routes, creation, composition/recording, arrangement save/reload, publish/preview/export, contribution acceptance, fork lineage, standalone MIDI, legacy audio, signed-source flows, conflicts/recovery, source-admission disable/rollback, and repeated switching.
- The deterministic benchmark ran five Chromium samples with 8 tracks and 2,000 notes: scheduler projection median 8.6 ms (slowest 15.1 ms); gesture-to-ready median 240.6 ms (slowest 384.1 ms); route/harness shell median 870.9 ms (slowest 1578.9 ms); zero console errors. All sample-free preset peaks remained below full scale.

## Manual and hosted gates

The automated Chromium suite provides structural keyboard/accessible-name coverage and fallback behavior, but perceptual audio quality, screen-reader narration, contrast inspection, reduced-motion feel, hardware Web MIDI, long-duration memory profiling, and final Firefox/Safari/Chromium hosted smoke checks remain manual release evidence. Signed-source refresh is covered structurally/local-browser rather than against hosted object delivery.

Repository completion is not hosted authority. An authorized operator must confirm the deployed commit/migrations and active environment, review these exceptions, run the transition procedure, and record the resulting capability state. Until then source admission stays enabled and upload controls remain available.

## PR 18 handoff

PR 18 starts only from the recorded deployed/capability state. Its retention and capacity graph must include ready and reserved source audio, persisted waveform peaks, workspace snapshots, revision/contribution/fork references, MIDI stems and mutable drafts, immutable stem versions and derivation lineage, normalized clip references, MIDI credit snapshots, avatars, verification/cleanup jobs, and operator transition history. Disabling admission is never authority to delete or weaken access to existing audio history.
