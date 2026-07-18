# Post-CHALLENGE milestone pulse check

Date: 2026-07-18
Repository checkpoint: `codex/challenge-03-voting-results` from merge checkpoint `f4671f06c35e1c5b446d27157683193592945bdf`
Outcome: BADGE-01 is the next implementation slice

## Evidence reviewed

- CHALLENGE-01 and CHALLENGE-02 are merged through PRs 60 and 61; CHALLENGE-03 builds directly on merge commit `f4671f0`.
- `/challenges/[slug]` and exact entry detail now expose phase-safe voting, private reporting, post-close totals, and current immutable completed results. `/admin/challenges/[challengeId]/results` owns moderation, vote review, finalization, complete corrections, and featured selection.
- Landing and dashboard call `get_featured_challenge()`; the signed-out landing does not depend on Auth state.
- Repository migration order now contains the seven hosted migrations, four LIB migrations, and three CHALLENGE migrations. `20260718202909_challenge_03_voting_results.sql` is last.
- Focused Vitest plus `00374_challenge_voting_results.test.sql` and `00375_challenge_vote_feature_concurrency.test.sql` prove deterministic cursor pagination, actor-wide idempotent vote admission/rate limits including rejected attempts, report evidence, live privacy inheritance for frozen results, optimistic moderation, result ties/corrections, and serialized featuring. The raw no-hosted-data browser gate and focused local browser fixture cover landing startup and the vote-to-signed-out-result journey without waiting for clock boundaries.

## Reconciled contracts

- Vote rows and command evidence are private. One actor-wide transaction lock serializes request replay and the cross-entry attempt budget; accepted and rejected attempts consume that budget while one logical row survives repeated desired-state changes. Public totals appear only after the frozen voting close.
- Entry ordering is stable inside an hourly UTC bucket and derives only from challenge/version, entry ID, and bucket. It never reads vote totals or submission popularity.
- Reports never hide content. Only administrator commands change challenge, entry, or vote moderation state, and each successful change appends audit evidence.
- A result version contains a complete frozen eligible-entry/total set, distinct official placements, and every computed highest-vote tie. Corrections append a complete superseding result and advance the optimistic pointer; no historical result row is rewritten. Public identity and attribution fields still require the source project, entrant profile, entry, and challenge to remain visible.
- The featured projection is a single public authority shared by landing and dashboard. Singleton locking makes its optimistic version safe under administrator contention; unavailable explicit choices fall back without leaking drafts, hidden challenges, reports, voters, or private-project relationships.
- BADGE-01 may read only exact finalized result authority. It must not issue awards from live votes, inferred ranks, superseded results, or client-provided winner data.

## Drift corrected

- Agent, roadmap, technical index, architecture, data-model, and delivery-plan status now mark the full CHALLENGE program complete and BADGE-01 next.
- Hosted-state counts now distinguish seven applied hosted migrations from seven repository-only LIB/CHALLENGE migrations.
- The tracked model now names the actual `challenge_result_entries`, placement/favorite normalization, `current_result_id`, and private feature-selection authority that BADGE-01 will consume.
- Local plan 033 replaces the earlier placeholder that BADGE planning must wait for CHALLENGE-03.

## Readiness

BADGE-01 is ready from `local/implementation-plans/033-challenge-achievements-profile-awards.md` once CHALLENGE-03 is reviewed and merged. It is sequential and must start from the exact green CHALLENGE-03 integration commit because it will share generated database types, result projections, public profile reads, and challenge routes.

Hosted rollout remains separately gated. The retained hosted Supabase project still has seven migrations; none of the four LIB or three CHALLENGE migrations were applied during this milestone. Applying them requires explicit authority and ordered rollout before any BADGE migration.
