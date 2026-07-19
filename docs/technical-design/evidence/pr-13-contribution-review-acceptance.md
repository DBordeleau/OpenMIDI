# PR 13 owner review and atomic contribution acceptance evidence

Status: implementation complete with bounded verification  
Date: 2026-07-13

## Landed behavior

- Project owners receive a dedicated bounded queue for non-draft contributions with version, arrangement, and base/current comparison metadata.
- The owner and author can load or download only the exact immutable submitted version they are authorized to inspect. User-scoped Postgres and Storage RLS authorize ready source audio; no service-role application shortcut exists.
- The contribution detail can switch between one read-only submitted-version studio and the current project revision without mounting simultaneous audio engines.
- One idempotent owner command requests changes, rejects, or accepts the exact current submitted version under project → contribution → version → workspace locks.
- Request changes preserves the workspace for editing and a later immutable version. Rejection archives the workspace and retains participant-private history.
- Acceptance revalidates the submitted manifest, normalized projection, engine/checksum, asset readiness, trim bounds, and project quota; then creates a contribution-linked revision, preserves per-track `added_by`, updates unique references/usage, emits bounded revision activity, advances the pointer, records review, marks accepted, and archives the workspace atomically.
- A stale accept creates no revision and instead records requested accept/applied request changes with reason `base_outdated`; OpenMIDI never auto-merges audio.

## Persisted and command contracts

- Migration: `20260713163458_owner_review_atomic_contribution_acceptance.sql`.
- New enums: `contribution_review_decision`, `contribution_review_reason`.
- New immutable table: `contribution_reviews`.
- Accepted revision lineage: `accepted_contribution_id`, `accepted_contribution_version_id`.
- Command: `review_contribution(uuid, uuid, contribution_review_decision, contribution_status, uuid, uuid, text)`.
- Exact-version routes: contribution version audio sources and stem downloads, both private/no-store with 600-second signed URLs.

## Verification

- Clean local migration reset passed.
- Database lint reported no warnings, all 330 pgTAP assertions passed, and generated database types matched the reset schema.
- Focused PR 13 pgTAP passed 24 assertions after one diagnostic/fix cycle.
- Contribution schema unit tests passed 4 assertions.
- `npm run check` passed: formatting, zero-warning lint, type checking, all 86 Vitest tests, and the Next.js production build.
- The targeted Chromium scenario was attempted twice. The first attempt exposed and fixed a missing fixture workspace request ID. The second reached authenticated navigation but timed out because the test-auth redirect raced the explicit review-page navigation; a deterministic post-sign-in URL wait was added, but the scenario was not rerun after reaching the two-attempt environment/harness ceiling.

## Scope boundary

PR 13 preserves normalized authorship and accepted lineage but does not complete PR 14's public credit aggregation/profile presentation. Public contributions, forks, discovery, threaded comments, notifications, moderation, and automatic merge/rebase remain out of scope.
