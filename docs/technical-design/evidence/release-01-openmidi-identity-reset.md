# RELEASE-01 OpenMIDI identity reset

Date: 2026-07-18
Outcome: Complete in the repository; hosted rollout remains deferred

## Identity contract

RELEASE-01 establishes one product and technical identity across application copy, metadata, package and repository setup, browser namespaces, persisted manifests, semantic diffs, exports, tests, local Supabase, migration source, notices, and current/historical documentation:

- product: `OpenMIDI`;
- npm package: `openmidi`;
- MIDI engine: `openmidi-midi`;
- MIDI engine version: `openmidi-midi-3_tone-15.1.22_presets-1`;
- semantic diff engine: `openmidi-midi-semantic-diff-1`;
- browser/internal prefix: `openmidi:`;
- local Supabase project: `openmidi`; and
- deterministic E2E actor: `openmidi-e2e@example.test`.

The tracked-tree identity contract has no textual compatibility allowlist. Binary files are excluded only when NUL bytes or invalid UTF-8 identify them as non-textual material. Obsolete browser drafts use a different key namespace, are not read or rewritten, and fail closed.

## Database reconciliation

The exact forward migration is `20260719010758_release_01_openmidi_identity_reconciliation.sql`. It deletes projects, revisions, arrangements, patterns, notes, tracks, clips, workspaces and snapshots, contributions and reviews, fork/source lineage, project discovery projections, saved patterns, public listings and credits, library reuse/report/moderation rows, challenge definitions/versions/entries/votes/results/moderation state, profile awards, and dependent musical holds/deletion/moderation rows in one transaction.

It preserves Auth users, profiles, administrator roles and genuine invitations, beta feedback and its administrator audit, avatar assets/versions/jobs, profile-targeted moderation and holds, the positive-version discovery singleton, licenses, genres, tags, instruments, MIDI/library preset catalogs, library lookup catalogs, reserved usernames, and badge definition/version catalogs. It rebuilds product-identity reserved usernames, canonicalizes the all-rights-reserved URL, and removes only obsolete deterministic local E2E invitations while preserving real invitations. The migration disables every user trigger on its exact affected relation set while it clears intentionally disposable immutable and append-only state, restores every trigger before commit, increments the discovery version, and then installs the canonical engine constraints, stored-function bodies, comments, and synthesis preset engine version.

The retained hosted project remains at seven applied migrations. Nine reviewed migrations are now pending: four LIB, three CHALLENGE, one BADGE, and this RELEASE-01 reconciliation. RELEASE-03 must apply the eight feature migrations first, record disposable and preserved row counts, then apply `20260719010758_release_01_openmidi_identity_reconciliation.sql` once.

## Operational boundary

No hosted Supabase migration, data deletion, provider configuration, Google OAuth change, Vercel project mutation, deployment, DNS change, or secret mutation occurred in RELEASE-01. RELEASE-03 remains the only authorized hosted execution slice.

## Verification

- Focused identity, recovery, manifest, interchange, export, and round-trip tests pass.
- `npm run db:rehearse:release-01` reproducibly resets to the pre-reconciliation migration, loads representative arrangements, patterns, revisions, contribution reviews, attribution/activity history, moderation actions, finalized challenge results, profile awards, and split-fragment legacy system identity values, applies the migration, and verifies that all disposable rows and obsolete system values are deleted while Auth users, profiles, administrator membership, genuine invitations, beta feedback, avatars, lookup catalogs, and the incremented discovery singleton survive. It also proves no user trigger remains disabled before restoring a clean replay.
- A seven-migration-shaped local rehearsal with no LIB/CHALLENGE/BADGE tables accepts the same migration and installs 24 canonical presets, five canonical engine constraints, and only canonical stored-function engine values.
- A clean local reset and `npm run db:check` pass the populated-state rehearsal, all 28 pgTAP files and 905 assertions, and the generated-type drift check. The reconciliation pgTAP contract proves the system-owned textual identity fields are canonical, exactly one positive-version discovery singleton remains, and empty Explore and public-profile project queries work immediately.
- `npm run test:e2e:local` passes the identity, Studio create/save/reload/publish/export, contribution acceptance, attribution, and fork-lineage paths. Persisted Studio actions expose `openmidi-midi` and `openmidi-midi-3_tone-15.1.22_presets-1`.
- Browser checks at 320 px and desktop find meaningful OpenMIDI content, no error overlay, no console errors, and no horizontal overflow on landing, sign-in, Explore, library, and challenge routes.
- `npm run check`, the standalone production build, `git diff --check`, and the final tracked-tree identity scan are required green handoff gates.
