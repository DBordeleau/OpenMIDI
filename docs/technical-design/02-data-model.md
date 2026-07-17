# Data model

Status: Current MIDI-only baseline plus forward reconciliation migrations

The clean baseline is intentionally split into four ordered migrations: foundation/identity, MIDI projects/arrangements, collaboration/discovery, and moderation/avatar operations. Forward migrations after that baseline preserve later merged behavior without rewriting already-applied history; the first reconciles administrator-managed beta invitations. Pre-pivot create/alter/drop history remains available through Git history and is never replayed by a clean database.

## Identity and catalogs

- `profiles` stores private lifecycle-bearing identity; `public_profiles` is the safe public projection.
- `reserved_usernames`, `private.signup_invitations`, and `private.app_admins` protect identity and operations.
- `activate_signup_invitation()` lets an active completed administrator activate one normalized address without granting direct table access; the Auth hook remains account-creation authority.
- `licenses`, `genres`, `tags`, and `instruments` are deterministic read-only catalogs.
- Email remains only in Supabase Auth.

## Projects and mutable workspaces

- `projects` owns metadata, owner, visibility/status, contribution availability, current revision, and exact fork source.
- `project_members`, `project_genres`, and `project_tags` normalize authorization and taxonomy.
- `workspaces` stores the mutable canonical manifest-v3 draft and optimistic lock.
- `workspace_tracks` and `workspace_clips` are the queryable MIDI projection. A clip references exactly one immutable `midi_pattern_version_id`.
- `private.workspace_snapshots` stores at most 20 bounded Postgres recovery snapshots per workspace.

Workspace saves are transactional and conflict-safe. No workspace table or projection contains a Storage object reference or a musical-media compatibility union.

## Reusable patterns and arrangements

- `midi_patterns` owns reusable identity, owner, visibility, source pattern, and rights attestation.
- `midi_pattern_versions` stores immutable creator snapshots, exact parent/source version lineage, canonical hash, duration, and CC BY 4.0 reuse terms.
- `midi_pattern_notes` stores canonical normalized notes with stable note IDs.
- `arrangement_versions` stores one immutable complete manifest-v3 snapshot and hash.
- `arrangement_tracks` and `arrangement_clips` normalize the same exact arrangement.
- `project_revisions.arrangement_version_id` and `contribution_versions.arrangement_version_id` bind wrappers to immutable arrangements.

Published history is append-only. Pattern and arrangement projection rows reject updates and deletes. Forks reuse exact pattern-version references copy-on-write.

## Collaboration and discovery

- `contributions`, `contribution_versions`, and `contribution_reviews` model draft, immutable submission, and owner decision.
- `revision_attributions` snapshots publisher and accepted-contributor credit names.
- `activity_events`, `project_stats`, `public_project_catalog`, and `discovery_state` support bounded public reads and ordering.

Acceptance verifies the expected contribution version and current project revision, then creates one project revision in a transaction. Rejected contributions remain visible only to their author and project owner.

## Moderation, deletion, and avatar operations

- Private moderation reports/actions and content holds are operational authority.
- Private deletion requests and retention jobs preserve recovery and legal-hold semantics.
- `assets` contains avatar originals only; ready rows are constrained to sanitized image metadata.
- `profile_avatar_versions` links private originals to immutable public derivative paths.
- Private upload/processing/cleanup jobs and the bounded operator commands own avatar lifecycle.
- Storage contains exactly `profile-images` (private) and `public-avatars` (public derivatives), with one authenticated reservation policy for originals.

There are no musical upload, waveform, quota, processing, network-worker, or scheduled-job tables/functions/extensions in the baseline.

## RLS and grants

All application-facing tables have RLS enabled. Anonymous access is limited to safe catalogs and public projections. Authenticated direct writes are denied; mutations use explicitly granted commands. Suspended or incomplete profiles fail mutation eligibility. Security-definer functions set `search_path=''`, authorize the caller, and have minimum execute grants. Default Supabase table privileges are revoked after baseline creation.

## Seed and generated types

`supabase/seed.sql` deterministically seeds reserved names, MIDI-oriented catalogs, the 24 exact preset rows, discovery state, and the local/CI invitation. Tests create isolated Auth/profile/project/pattern/arrangement fixtures transactionally. `npm run db:types` atomically regenerates `src/lib/supabase/database.types.ts` from the clean local schema; generated output is never hand-edited.
