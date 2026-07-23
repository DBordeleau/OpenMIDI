# Data model

Status: Current MIDI-only baseline plus forward reconciliation migrations

The clean baseline is intentionally split into four ordered migrations: foundation/identity, MIDI projects/arrangements, collaboration/discovery, and moderation/avatar operations. Forward migrations after that baseline preserve later merged behavior without rewriting already-applied history; the first, `20260717142701`, reconciles administrator-managed beta invitations and is applied to the retained hosted project. Pre-pivot create/alter/drop history remains available through Git history and is never replayed by a clean database.

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

`private.stale_owner_workspace_resolutions` stores owner/request-scoped idempotency receipts for stale-draft recovery and has no direct application access. `resolve_stale_owner_workspace_v3` validates exact workspace lock, stale base, and current-revision authority before performing one transaction. Restart archives the stale source only when a current-revision replacement workspace, normalized projections, snapshot, and receipt all succeed. Preserve creates a private direct fork whose source lineage points to the stale base, copies that base into immutable fork revision 1 without duplicating pattern notes, places the acknowledged stale manifest in the fork's active workspace after authority-field rewriting, then archives the old workspace. A failure rolls back the target and source archive together.

## Reusable patterns and arrangements

- `midi_patterns` owns reusable identity, owner, visibility, source pattern, and rights attestation.
- `midi_pattern_versions` stores immutable creator snapshots, exact parent/source version lineage, canonical hash, duration, CC BY 4.0 reuse terms, and a derived optional `silhouette_v1`. The silhouette is canonical base64 for 64 time columns by eight pitch bands; it is computed after normalized note insertion, never replaces note authority, and remains all-null for note-free patterns.
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

## Public MIDI library

- `midi_library_listings` stores append-only editions for one exact immutable pattern version. At most one edition per pattern is active; creator unlisting timestamps that edition and relisting appends another.
- Each edition snapshots the creator identity, normalized `commercial_reuse` or `reference_only` mode, versioned rights-basis attestation, bounded public source terms, controlled category/preset/tags, and note-derived duration/count/pitch/polyphony facets.
- `midi_pattern_external_credits` stores immutable bounded external-credit snapshots separately from verified platform lineage. `midi_library_listing_tags` normalizes the controlled library tag set.
- `search_public_midi_library` is the only anonymous listing/note projection. It rejects malformed filters, returns at most 25 active non-hidden rows with keyset ordering, and never exposes private attestation evidence or base listing tables.
- Direct pattern-version RLS remains owner/member/public-project scoped. A library listing does not make unlisted/private base rows enumerable; reference-only notes are readable only inside the safe catalog projection.
- `get_public_midi_library_listing` returns one active non-hidden exact listing with notes, rights, separate external credits, platform lineage, a deterministic maximum of 100 authorized same-pattern history versions that always includes the listed version, and exact-version public-project usage. `get_public_midi_library_pattern_comparison` independently proves both explicit selections use the same pattern and satisfy the same listing/public-project authorization rules, including versions outside that first bounded history window.
- `private.midi_library_reports` stores bounded claimant/source evidence against an exact listing and pattern version. `private.midi_library_moderation_actions` stores idempotent optimistic administrator audit records. Report submission has no visibility side effect; hide/restore updates only listing moderation visibility/version and safe public functions exclude hidden rows immediately.
- `saved_midi_patterns` is an RLS-protected private bookmark keyed by user and exact immutable pattern version. It references the listing edition used to save and copies no notes or ownership.
- `private.midi_library_reuses` snapshots the exact source listing/pattern/version, CC BY terms, creator credit, and external credits for import, explicit fork, and editor-copy commands. A narrow private reuse-access relation lets only the reuser load an exact imported source in Studio after the public listing projection closes.
- `reuse_midi_library_pattern` validates source eligibility independently, uses the existing workspace lock for imports, and creates owned private pattern/version children before editor navigation. Inherited external credits are append-only rows attached to the child version. `get_midi_library_export` returns validated structured notes/attribution only; the browser creates the file.

## Moderation, deletion, and generated avatars

- Private moderation reports/actions and content holds are operational authority.
- Private deletion requests and retention jobs preserve recovery and legal-hold semantics.
- `profiles.avatar_config` stores the optional validated version-1 DiceBear Adventurer Neutral configuration; `NULL` means initials. The UUID-derived seed, exact option keys/ranges, and package compatibility are durable constraints.
- `profiles.avatar_config_revision` is owner-private optimistic-concurrency authority for save/reset. `avatar_updated_at` records the latest persisted preference change.
- Safe public reads expose only `avatar_config`; lifecycle and revision state remain private. Generated SVG, image bytes, paths, and remote renderer URLs are never persisted.
- Account deletion clears configuration and preserves the existing 30-day recovery model. Recovery does not restore a prior avatar preference.
- AVATAR-03 retired avatar asset/version tables, upload/processing/cleanup jobs, legacy profile pointers, Storage admission, and asset hold/retention branches. Generic profile/project/contribution holds, deletion expiry, moderation metadata cleanup, and recovery remain active.

There are no musical upload, waveform, quota, processing, network-worker, or scheduled-job tables/functions/extensions in the baseline.

## Beta feedback

- `private.beta_feedback` stores bounded authenticated bug reports and suggestions with disclosed route/application/browser context and no attachments, logs, manifests, tokens, or signed URLs.
- Private administrator request/audit rows serialize classify, handle, reopen, and delete commands without retaining deleted report bodies.
- Submit and administrator queue/detail/mutation functions authorize active actors, rate-limit intake, and expose no direct table grants.

## RLS and grants

All application-facing tables have RLS enabled. Anonymous access is limited to safe catalogs and public projections. Authenticated direct writes are denied; mutations use explicitly granted commands. Suspended or incomplete profiles fail mutation eligibility. Security-definer functions set `search_path=''`, authorize the caller, and have minimum execute grants. Default Supabase table privileges are revoked after baseline creation.

## Seed and generated types

`supabase/seed.sql` deterministically seeds reserved names, MIDI-oriented catalogs, the 24 exact preset rows, discovery state, and the local/CI invitation. Tests create isolated Auth/profile/project/pattern/arrangement fixtures transactionally. `npm run db:types` atomically regenerates `src/lib/supabase/database.types.ts` from the clean local schema; generated output is never hand-edited.

## Implemented and planned post-pivot extensions

CHALLENGE-01 through CHALLENGE-03 implement the complete curated-challenge lifecycle, exact-entry, voting, moderation, result, and featuring authority below. BADGE-01 consumes that frozen result boundary without inferring outcomes from mutable votes.

- **Challenges (complete through results):** `challenges` holds stable lifecycle, moderation, current-version, and optimistic `current_result_id` pointers. `challenge_versions` and `challenge_judge_credits` are append-only immutable snapshots containing frozen UTC boundaries, prompt/presentation, host/judge credits, an optional exact starter revision, and validated canonical constraint-v1 JSON plus SHA-256. `challenge_entries` pins the exact current project revision, challenge version, display attestation, identity/attribution snapshots, normalized facts, and authoritative evaluation/hash. A partial unique index permits one active entry per entrant/challenge; replacement appends and closes the prior active row atomically. `private.challenge_entry_commands` retains command audit/idempotency authority. Time-derived functions return no pre-voting identities/counts, then expose only active visible exact entry/preview data without changing source project, download, editor, or reuse rights.
- **Challenge votes and moderation:** `challenge_votes` stores one private logical row per `(challenge_entry_id, voter_id)` with active/removed/excluded state and an optimistic version. `private.challenge_vote_commands` provides actor-wide serialized request replay and a 60/hour attempt budget across entries; accepted and rejected attempts both retain a replayable private response. Public roles have no table grant; before close the only voter read is a bounded list of the caller's own active entry IDs. `private.challenge_reports` stores bounded challenge/entry reports and the administrator projection returns their target, reason, optional details, and timestamp, while `private.challenge_moderation_actions` audits optimistic challenge hide/restore, entry hide/restore/disqualify, and vote exclude/restore. Reporting alone changes no visibility.
- **Challenge results and featuring:** `challenge_results` is an append-only correction chain pinned to one exact challenge version. `challenge_result_entries` freezes every eligible visible entry and its recomputed included-vote total for that result version; `challenge_result_placements` and `challenge_result_community_favorites` normalize distinct official places and every highest-total tie. Finalization and correction accept no client totals or favorites, reject stale/early/incomplete/ineligible placement authority, and advance only `challenges.current_result_id`; older results remain immutable. Frozen rows remain permanent authority, but public result projections reapply current source-project, entrant-profile, entry, and challenge visibility before exposing their identity or attribution snapshots. `private.challenge_featured_selection` stores at most one explicit administrator choice and `private.challenge_featured_actions` preserves selection history; a singleton transaction lock makes its optimistic version authoritative under administrator contention. The safe featured projection excludes draft/hidden authority and deterministically falls back to next scheduled, active open/voting, then most recently completed.
- **Achievements:** `badge_definitions` provides stable codes and active/current-version pointers; append-only `badge_definition_versions` owns bounded musician-facing copy, bundled presentation codes, and the fixed Winner/Favorite/Top Placement qualification shapes. `profile_awards` is immutable evidence for one exact recipient, challenge/version/current result, entry, project revision, and badge version, with durable identity and presentation snapshots plus deterministic result-entry-badge uniqueness. `private.challenge_award_issuance` records append-only finalization/reconciliation counts and replay responses. Initial result finalization and every correction invoke the same row-locked issuer after advancing `current_result_id`, so award failure rolls back the result transition. Earlier award rows survive corrections, but `list_public_profile_awards` returns at most 24 keyset-ordered rows only when the award result is still the challenge's current pointer and all recipient/challenge/entry/source visibility checks pass.

Every new application-facing table enables RLS in its creation migration and receives explicit least-privilege grants. Public library, completed-challenge, leaderboard, and award projections must not reveal private-project relationships, reports, claimant context, hidden listings/entries, or pre-close votes; feedback, saved clips, challenge administration, and moderation evidence are never broadly selectable. Do not rely on provider defaults to decide Data API exposure.
