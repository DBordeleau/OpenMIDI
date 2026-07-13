# PR 14 attribution and immutable credit presentation evidence

Status: implementation complete with bounded verification  
Date: 2026-07-13

## Landed behavior

- Newly verified source audio retains an uploader-prefilled provisional credit but cannot enter workspace, submitted-version, or revision history until its owner confirms an ordered 1–12-credit list.
- Confirmation supports database-derived self credits and external plain-text credits, requires a creator, rejects normalized duplicates, is request-idempotent, and becomes immutable before first reference.
- Transaction-local projection triggers preserve existing publisher/review RPC signatures while atomically copying every confirmed track credit into revision-owned snapshots.
- Revisions separately snapshot the publishing actor and accepted contribution author; arrangement-only acceptance therefore retains contributor attribution without treating owner/uploader activity as musical authorship.
- Project presentation separates publisher, accepted contributor, per-track role credits, current music aggregation, and bounded accepted contributors.
- Active safe profiles may be linked while snapshot names remain stable across profile changes. Authenticated settings show authorized accepted history; anonymous profiles expose no private project history.
- Stem export manifest v2 carries each file's ordered role-bearing credits.

## Persisted contracts

- Migration: `20260713171758_immutable_revision_credit_snapshots.sql`.
- Asset confirmation: `credits_confirmed_at`, request ID/hash, and `confirm_source_asset_credits(uuid, uuid, jsonb)`.
- Immutable tables: `revision_track_credits` and `revision_attributions`.
- Revision attribution kinds: `publisher`, `accepted_contributor`.
- New public-schema tables have explicit grants, RLS, parent-visibility policies, and no application mutation grants.

## Verification

- Clean local migration reset and database lint passed with no warnings.
- All 347 pgTAP assertions passed and generated database types match the reset schema. The first full run identified one legacy studio fixture that lacked explicit credit confirmation; only that fixture was corrected before rerunning the failed database-test/type-drift layers.
- Focused PR 14 pgTAP passed 17 assertions; key publish/workspace/contribution/review regression files passed 104 assertions during iteration.
- `npm run check` passed: Prettier, zero-warning ESLint, type checking, all 89 Vitest tests, and the Next.js 16.2.10 production build.
- The targeted contribution-acceptance Chromium scenario was attempted twice. Attempt one exposed a PostgREST relationship ambiguity in the new accepted-history query; the FK-qualified query was fixed and type checking passed. Attempt two stopped before browser execution because local Auth actor creation returned HTTP 502 immediately after reset and Node then hit a Windows libuv assertion. Per the two-attempt ceiling, E2E is reported unavailable rather than retried.

## Scope boundary

PR 14 does not implement user-to-user credit claiming, credit corrections after confirmation, rights disputes, royalty splits, payments, forks, public project visibility/discovery, or public rejected contributions. PR 15 must preserve these snapshots through copy-on-write fork lineage; PR 16 activates public-project credit/profile queries.
