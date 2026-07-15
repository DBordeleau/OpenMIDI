# Source-audio admission transition

MIDI-07 installs a reversible database-authoritative control for new `source_audio` reservations. The migration inserts the single trusted control row with admission **enabled**. This runbook does not authorize changing a hosted environment; STUDIO-06 must first accept the complete Studio-native parity evidence and obtain separate hosted-mutation approval.

STUDIO-06 repository parity and the local disabled/rollback rehearsal are complete. Hosted evidence acceptance, deployment confirmation, and capability mutation were not authorized, so the current hosted state remains **enabled** and the procedure below remains pending.

## Authority and compatibility

- `private.source_admission_control` is the authoritative global prototype state. It is not exposed through the Data API and is not a plan, payment, or per-user entitlement.
- `get_source_admission_capability()` exposes only the current boolean for capability-driven UI. Anonymous and authenticated clients cannot mutate the control.
- `reserve_source_asset()` returns `audio_uploads_unavailable` for a new request while disabled, before it creates an asset/upload row or changes user/global reserved bytes.
- An exact idempotent replay of a reservation created before the lock remains valid through its original 24-hour expiry. Completion, verification, cancellation, and expiry remain unchanged during the deployment grace period.
- Existing ready source audio, workspace/revision/contribution references, private playback/signing, downloads, browser export, publication, acceptance, and copy-on-write forks remain supported.

## MIDI-07 deployment order

1. Apply `20260715042339_midi_07_source_admission_control.sql`.
2. Confirm the public capability returns `true`; do not change it.
3. Deploy the matching application and generated database types.
4. Confirm normal reservation still works and the uploads page remains enabled.
5. Run disabled-mode tests in an authorized local or preview environment, restore `true`, and confirm legacy audio regressions.

No hosted migration, capability mutation, or deployment is part of the MIDI-07 repository change itself.

## Future STUDIO-06 enablement

Only after the documented Studio-native creation, recording, arrangement, publication, preview, collaboration, fork, export, accessibility, and legacy-audio gates pass:

1. Deploy the MIDI-07 database and application readers while admission is still enabled.
2. Confirm the active environment and current value without printing credentials:

   ```sql
   select * from public.get_source_admission_capability();
   ```

3. With separately approved operator authority, close database admission first:

   ```sql
   select public.operator_set_source_admission_enabled(false);
   ```

4. Verify a new authenticated request returns `audio_uploads_unavailable` and creates no asset/upload row or quota delta.
5. Allow valid pre-lock reservations to finish, verify, cancel, or expire within their existing 24-hour lifetime. Do not shorten or rewrite them.
6. Deploy or confirm the unavailable UI state and copy after database authority is closed.
7. Re-run private playback/download/export/publish, mixed contribution acceptance, and audio fork checks against existing assets.
8. Record the change time and evidence in the future PR 18 operator history/capacity work.

## Rollback

If the Studio-native path has a severe blocker, retain all MIDI/audio history and re-enable only new reservation:

```sql
select public.operator_set_source_admission_enabled(true);
```

Confirm the read capability is `true`, create one small non-sensitive reservation, and verify user/global reserved-byte accounting. Rollback never rewrites projects, revisions, contributions, forks, assets, or MIDI versions.

## Capacity impact and PR 18 handoff

MIDI-07 adds one private boolean/timestamp row and no Storage objects. The uploads page adds one bounded boolean RPC read; disabled reservation attempts add no source bytes or quota reservations. Existing source delivery and egress are unchanged. PR 18 must report the authoritative admission state and transition history separately from source/derived Storage usage, and continue reference-aware retention across ready audio, in-flight reservations, waveform peaks, workspaces, revisions, contributions, and forks.
