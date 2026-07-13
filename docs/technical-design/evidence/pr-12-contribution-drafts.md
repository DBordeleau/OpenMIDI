# PR 12 contribution drafts and immutable submissions evidence

Status: implementation complete with bounded verification
Date: 2026-07-13

## Landed behavior

- Active private-project owners can idempotently open or close submissions with optimistic project locking. The setting does not change visibility or license.
- An active, profile-complete non-owner member can atomically create one live private contribution and linked workspace from the exact current revision. Audio bytes and project quota/reference projections are not copied.
- Existing workspace snapshot reservation, autosave, signed source access, stem download, local recovery, and browser WAV paths support author-owned contribution workspaces while preserving owner-workspace authorization.
- Submission accepts only the exact acknowledged workspace lock, checksum, ready snapshot, current base revision, and approved contributor-attestation-v1. It freezes the canonical manifest and normalized tracks without advancing project history.
- Withdrawal archives the mutable workspace while retaining immutable submitted versions. PR 13 owns request-changes, review, rejection, and atomic acceptance.
- Authors can read all their contribution states. Owners cannot see drafts, begin seeing metadata and versions after submission, and cannot read contributor workspaces. Unrelated, non-member, incomplete, suspended, and anonymous actors receive no contribution access.

## Persisted and command contracts

- Migration: `20260713154401_contribution_drafts_immutable_versions.sql`, applied after PR 11.5.
- Tables: `contributions`, `contribution_versions`, and `contribution_version_tracks`; nullable composite-constrained `workspaces.contribution_id`.
- Commands: `set_project_contributions_open(uuid, integer, boolean)`, `create_contribution_workspace(uuid, uuid, uuid, text, text)`, `submit_contribution(uuid, uuid, integer, uuid, text, text)`, and `withdraw_contribution(uuid, contribution_status, uuid)`.
- Shared lock order is project, contribution, workspace. Create idempotency is `(author_id, create_request_id)`; submit idempotency is `(contribution_id, submission_request_id)`, with expected authority/content fields checked on replay.
- Attestation version: `contributor-attestation-v1`.

## Verification

- Clean local migration reset passed.
- Database lint, all 306 pgTAP assertions, and generated-type drift checking passed.
- All 85 Vitest unit/component tests and the production build passed.
- Changed-file ESLint passed, and focused contribution/navigation Vitest passed 6 tests.
- The targeted contribution Chromium scenario is implemented but was not run after the user requested expedited, lower-cost verification.
- The aggregate `npm run check` command stopped at formatting because the pre-existing, untouched PR 11 evidence file is not Prettier-clean. Its remaining underlying lint/test/build checks were run separately; full lint reports only that existing export-component warning plus the corrected PR 12 warnings.

## Scope boundary

The workflow is complete only for a non-owner who already has private project membership. There is no membership-management or public discovery UI. Owner audition/review, request changes, rejection, acceptance, project asset-reference promotion, and attribution presentation remain later slices.
