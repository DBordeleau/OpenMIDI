# PIVOT-00 audio removal inventory

Status: Accepted removal baseline; no runtime/schema removal occurs in PIVOT-00
Date: 2026-07-16
Target slices: PIVOT-04–PIVOT-09

## Purpose

This inventory identifies current repository surfaces that exist wholly or partly to support uploaded source audio. It prevents Wave 1 workers from deleting compatibility code before MIDI-only consumers are ready and gives PIVOT-07/PIVOT-08/PIVOT-09 an explicit removal checklist.

Historical implementation/evidence documents are retained. “Remove” below means remove from the current application/schema/baseline, not erase Git history.

## Packages

Remove in PIVOT-07 after Studio/public consumers use MIDI-only v3:

- `@waveform-playlist/browser`
- `@waveform-playlist/playout`
- `@mediabunny/flac-encoder`
- `mediabunny` if no non-FLAC consumer remains

Retain:

- `tone`
- `@tonejs/midi`
- Supabase clients/CLI
- Motion and React UI dependencies

Review `package-lock.json` only through the owning dependency slice.

## Application routes

Remove:

- `src/app/api/assets/[assetId]/verification/route.ts`
- `src/app/api/projects/[projectId]/revisions/[revisionId]/audio-sources/route.ts`
- `src/app/api/projects/[projectId]/workspaces/[workspaceId]/audio-sources/route.ts`
- `src/app/api/projects/[projectId]/contributions/[contributionId]/versions/[versionId]/audio-sources/route.ts`
- all three `downloads/stems/route.ts` variants under revision, workspace, and contribution version
- `/uploads`
- standalone source-upload/history UI reached from navigation/dashboard

Replace rather than delete:

- revision preview route: return MIDI-only structured scheduling; never sign Storage audio
- Studio/project/history routes: retain routes, remove audio branches/copy
- `/stems` routes: rename/reframe as pattern library/management only after product routing is decided; do not silently keep “stem” as canonical MIDI vocabulary

## Application feature/runtime code

Remove in PIVOT-07:

- `src/features/studio/waveform-playlist-adapter/`
- `src/features/studio/arranger/audio-peaks.client.ts`
- audio/composite ports in `src/features/studio/composite-controller.ts` and related tests
- source descriptor/loader/buffer-cache contracts and tests
- audio branches in arranger view models, Studio surfaces, preview contracts/schedules, session contracts, project types, and manifest compatibility
- manifest v1 and v1-to-v2 audio migration code/fixtures after v3 cutover
- `src/features/assets/waveform-peaks/`
- `src/features/assets/browser-codec/`
- source upload, upload actions, verification polling, source schemas/types/repositories, and source upload history
- `src/server/services/audio-source-delivery.ts`
- audio-specific behavior in `src/server/services/stem-exports.ts`
- `src/features/exports/stem-download-panel.client.tsx`
- source/stem filename helpers and tests that have no MIDI export consumer
- audio-only mix-export validation if local MIDI WAV rendering does not use it

Replace/simplify in the owning cutover slices:

- `src/features/midi/project-export.client.ts`: retain MIDI synthesis and browser-local WAV output; remove source downloads/decoding
- `src/features/studio/midi-adapter/midi-studio-surface.client.tsx`: MIDI-only runtime
- `src/features/studio/arranger/arranger-workspace.tsx`: MIDI tracks/clips only
- `src/features/studio/components/studio-launcher.client.tsx`: MIDI capability checks only
- discovery/project/profile presentation: patterns/presets/diffs rather than source/audio metadata
- repository selects/mappers for workspaces, revisions, and contributions: arrangement/pattern model only

Brand-only decorative waveform graphics are not automatically audio-domain code. Review landing imagery separately; it may remain if it still communicates music rather than uploaded waveforms.

## Supabase Edge Functions and scheduled work

Remove in PIVOT-08/PIVOT-10:

- `supabase/functions/verify-source-audio/`
- `supabase/functions/_shared/source-verification.ts`
- `[functions.verify-source-audio]` configuration
- `private.asset_verification_jobs`
- verification lease/kick/finalization/retry/recovery/pruning functions
- minute recovery cron calling `private.invoke_asset_verification_recovery()`
- verification-history pruning cron if it has no non-audio consumer
- Vault secrets/config for verification URL, anon key, and recovery secret
- operator fallback `scripts/verify-source-asset.mjs`

Retain:

- `supabase/functions/process-profile-image/`
- profile-image recovery/cleanup secrets and scripts

## Storage buckets and policies

Remove from the new baseline/new hosted project:

- `source-audio`
- `workspace-snapshots` after bounded JSONB recovery snapshots are authoritative
- `derived-assets` if no non-audio derivative remains after waveform removal
- reserved source insert/read/delete policies
- member/project/contribution source-read policies
- waveform peak upload/read/delete policies
- source object accounting/reconciliation

Retain:

- private profile-avatar original bucket
- public sanitized avatar derivative bucket
- exact profile-image policies/functions

Do not delete old hosted buckets/objects in an implementation worker. PIVOT-10 provisions a fresh project; old-project deletion requires separate final approval.

## Database types, tables, and projections

Remove from the target baseline:

- source-audio lifecycle values and audio media metadata from generic asset authority
- `asset_uploads` where used for source audio
- `asset_credits` where used for source audio
- `project_asset_references`
- `project_storage_usage`
- source/reserved/derived byte quota columns and global admission thresholds
- `waveform_peak_derivatives`
- `private.asset_verification_jobs`
- `private.source_admission_control`
- audio-specific retention blockers/jobs/object reconciliation
- legacy audio columns/discriminants on workspace/revision/contribution tracks and clips
- project `compatibility = legacy_hybrid`
- `revision_track_credits`
- `revision_midi_track_credits`
- duplicate immutable revision/contribution track/clip projections after both wrappers point to `arrangement_versions`
- Storage-backed workspace snapshot asset relationships after JSONB snapshots replace them

Retain or replace:

- profiles, invitations/admin mappings, projects/members/taxonomy
- workspaces and optimistic concurrency
- project revisions and contribution versions as immutable wrappers
- contributions/reviews/acceptance and fork lineage
- discovery/public catalog and profile history
- moderation reports/actions/holds/deletion with audio branches removed
- avatar-specific assets/versions/processing if keeping their current implementation is safer than renaming during the pivot
- MIDI stem tables only until PIVOT-03/PIVOT-04 replace them with patterns/versions/notes

## Database functions/policies requiring removal or replacement

Remove:

- `reserve_source_asset` and source upload completion/cancellation/failure functions
- source verification lease/finalize/fail/retry/recovery functions
- source admission read/write control functions
- source object read/upload/delete authorization helpers
- waveform peak reserve/finalize/cancel/expiry/access functions
- audio descriptor/preview/download functions
- audio quota reservation/reconciliation and source retention branches
- audio-specific moderation denial and hold/reference checks

Replace:

- workspace save/publication/submission/acceptance/fork functions with manifest v3 arrangement/pattern relationships
- preview/public read functions with bounded MIDI-only payloads
- project deletion/retention functions with project/pattern/arrangement/avatar references only
- public catalog/history projections with MIDI metadata and semantic summaries

Every new exposed table must have RLS and actor-matrix pgTAP. Every security-definer command must use a safe `search_path`, explicit actor authorization, revoked `PUBLIC`, and minimum execute grants.

## Scripts and package commands

Remove in PIVOT-07/PIVOT-08:

- `scripts/benchmark-flac-codec.mjs`
- `scripts/benchmark-studio-audio.mjs`
- `scripts/generate-studio-audio-fixtures.mjs`
- `scripts/generate-studio-flac-fixtures.mjs`
- `scripts/verify-source-asset.mjs`
- source/peak branches in `scripts/run-retention.mjs`
- `assets:verify`
- `assets:cleanup` if it has no avatar/general use after refactor
- audio upload/optimization-specific E2E commands

Retain/simplify:

- database/type/test automation
- local Auth runner
- local Storage only where avatar tests require it
- `avatars:process` and `avatars:cleanup`
- retention operator only for remaining moderation/deletion/avatar data

## Automated tests and fixtures

Remove or replace:

- `tests/e2e/audio-upload-optimization.spec.ts`
- `tests/e2e/source-admission-transition.spec.ts`
- WAV/FLAC source upload/verification sections in `tests/e2e/identity.spec.ts`
- audio hydration/peak/source assertions in `tests/e2e/studio-startup.spec.ts`
- legacy-audio branches in discovery, contribution, and fork journeys
- source asset, source verification, FLAC worker, waveform peak, source loader, audio preview, stem download, and mixed scheduler unit tests
- committed/generated WAV/FLAC fixtures used only for current audio compatibility
- pgTAP expectations for source admission, verification, waveform peaks, audio quotas, Storage source policies, legacy track credits, and mixed manifests

Retain/add:

- auth/onboarding/invitation/profile/avatar tests
- MIDI editor/recording/arranger/runtime tests
- v3 manifest/pattern/note/semantic-diff tests
- workspace save/reload/publish tests
- contribution review/acceptance and fork lineage tests
- moderation/deletion tests for the remaining domain
- MIDI-only preview/export tests
- static tests proving removed audio routes/dependencies/schema/cron are absent

## Environment variables and hosted configuration

Remove from active setup documentation/new hosted project:

- source verification recovery URL/key/secret
- verification Edge Function deployment/config
- source-audio admission operational controls
- audio bucket setup
- audio quota/cleanup instructions

Retain:

- Supabase URL and publishable/server credentials in their correct boundaries
- Google OAuth configuration
- test Auth controls restricted to local/CI
- profile-image processing/recovery secrets
- Vercel application configuration

## Documentation

Update current authority during PIVOT-00/PIVOT-09:

- `docs/PRD.md`
- `docs/ROADMAP.md`
- `README.md`
- `AGENTS.md` and `CONTRIBUTING.md`
- technical-design index, architecture, data model, delivery plan, ADR index
- brand positioning and current Studio wording
- test/setup/operations commands
- local implementation-plan policy

Retain as historical evidence with a superseded/historical label rather than rewriting:

- PR 05–PR 14 audio implementation history
- OPT-01–OPT-05 evidence
- MIDI/STUDIO/UX evidence describing the path that produced the current implementation
- old source-admission and audio optimization plans/runbooks, unless a current command could dangerously mutate the wrong environment; dangerous current runbooks must receive a warning banner

## Baseline search families

PIVOT-07–PIVOT-09 should repeatedly inspect, classify, and drive current-code matches toward zero using:

```powershell
rg -n -i 'source_audio|source-audio|waveform_peak|waveform-playlist|legacy_hybrid|audio-sources|verify-source-audio|asset_verification|flac|wav' src scripts tests/e2e supabase package.json .env.example
```

Matches are allowed after completion only when they are:

- explicit historical evidence;
- profile-avatar MIME/media handling unrelated to music;
- browser-local synthesized WAV export;
- tests asserting prohibited current audio surfaces are absent.
