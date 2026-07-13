# PR 10 — editable workspaces and conflict-safe autosave

Date: 2026-07-13

## Delivered boundary

- Project owners can create or reopen one active private workspace based on the exact current revision.
- The lazy client-only studio supports the manifest-v1 editing subset: add/remove/reorder, label, instrument, position, trim, gain, pan, mute, and solo.
- Source URLs are issued for the exact authorized workspace and remain transient browser inputs.
- Debounced autosave exports and validates the Jam Session manifest, uploads an immutable private JSON recovery snapshot, and saves with an expected workspace `lock_version`.
- A stale writer enters a visible conflict state instead of overwriting the newer draft. Offline/save failures keep a local recovery copy keyed by user and workspace.
- Published revisions and the project current-revision pointer are never mutated by workspace saves.

## Database and authorization proof

The forward-only PR 10 migration adds `workspaces`, `workspace_tracks`, private snapshot reservations, insert-only Storage policies, explicit Data API grants, and the create/reserve/save commands. The security-definer functions use a fixed search path, authorize `auth.uid()`, and expose only the minimum execute grants.

The pgTAP suite covers anonymous, owner, unrelated authenticated, suspended, and project-owner paths; one-active-workspace idempotency; exact-base checks; RLS visibility; direct-write denial; Storage upload scope; snapshot immutability; successful save projection; stale-version conflict; idempotent retry; and proof that published history is unchanged.

## Automated verification

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- clean `npm run db:reset`
- `npm run db:check` (13 files, 220 pgTAP assertions; schema lint and generated-type drift green)

The final merge-readiness run is recorded in the PR handoff. Browser verification requires the reduced local Auth/Storage stack and the gated deterministic actor.

## Deferred deliberately

- Publishing a later immutable project revision from the workspace.
- Contribution workspaces and submitted contribution versions.
- Mix/stem export and download.
- Automatic merging of divergent arrangements.
