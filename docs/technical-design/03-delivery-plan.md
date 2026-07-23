# Delivery plan and verification

Status: MIDI-only MVP through RELEASE-03 deployed as an invite-only beta

## Implemented foundation

PIVOT-01 through PIVOT-10 and the final administrator-invitation reconciliation delivered the manifest-v3 domain, deterministic semantic diff, bundled preset runtime, normalized Postgres model, Studio and collaboration cutovers, public reads, application/Supabase cleanup, clean migration baseline, hosted rehearsal, deterministic testing, and documentation reconciliation.

The historical PR 01–20, OPT-01–OPT-05, MIDI-01–MIDI-07, and STUDIO-01–STUDIO-06 plans explain how the repository reached the pivot. They are superseded sequencing and must not be used as current environment, migration, or deployment instructions.

## Normal implementation gates

1. Inspect the relevant authority and nearby code.
2. Run the narrowest unit, pgTAP, or browser path while iterating.
3. Run `npm run check`; it includes formatting, lint, strict types, unit tests, production build, and the MIDI-only static contract.
4. For schema work, start local Postgres, run one clean `npm run db:reset`, `npm run db:check`, regenerate types atomically when needed, and stop Supabase.
5. For cross-feature browser behavior, start the reduced Auth stack and run `npm run test:e2e:local` once. The default path covers identity, generated avatars, MIDI Studio save/publish/preview, contribution acceptance, fork lineage, and stale-owner-draft recovery without Storage or Edge Runtime. The focused recovery path is `npm run test:e2e:local -- tests/e2e/stale-owner-draft.spec.ts`.
6. Run `git diff --check` and review generated artifacts, secrets, and unrelated changes.

Global application chrome must not spend production request budget solely because a Next.js link entered the viewport. Authenticated primary navigation, shared-header destinations, authenticated dashboard content destinations, and repeated project-index project/Studio links begin with prefetch disabled and restore the framework default only after pointer or keyboard intent; always-visible footer and affected dashboard/project-index button destinations remain no-prefetch. Preserve signed-out-first rendering and fresh authorization. Do not extend this policy to public content lists without causal evidence. For request-fanout changes, verify the deterministic Link prop contract locally, then use one fixed-window, categorized production observation that keeps Edge Requests, Function Invocations, cache hits, middleware, direct Supabase traffic, and browser-local work distinct.

The two-attempt ceiling applies to an unchanged environment blocker. A concrete fixture, selector, query, or harness correction permits one validation run of the corrected path.

## Post-pivot MVP sequence

DIFF-01 through DIFF-03, FEEDBACK-01, LIB-01 through LIB-03, CHALLENGE-01 through CHALLENGE-03, BADGE-01, and RELEASE-01 through RELEASE-03 are complete.

1. **Wave A — DIFF and FEEDBACK:** complete with landing-matched static semantic comparisons for authorized revision pairs plus authenticated beta feedback and a private administrator queue.
2. **Wave B — LIB:** complete with rights-gated public pattern listing, commercially reusable and reference-only modes, All/mode Explore filtering, external credits, copyright reporting/moderation, bounded musical search/filtering, browser-local preview/export, any-two-version history diffs, private saved clips, and attributed reusable-only save/import/fork/editor actions.
3. **Wave C — CHALLENGE:** complete with administrator-curated immutable versions, time-derived phases, authoritative eligibility, exact entries, private serialized voting, popularity-independent rotation, private reports, optimistic moderation, append-only permanent results/corrections, all favorite ties, and canonical featured discovery.
4. **Wave D — BADGE:** complete with a versioned bounded catalog, transactional exact-current-result issuance, immutable correction evidence, serialized reconciliation, and safe profile cards linking to permanent result/entry context.
5. **Wave E — RELEASE:** complete through the authorized RELEASE-03 ledger reconciliation, provider configuration, hosted seed import, Vercel deployment, and production smoke.

Library, challenge, badge, and release slices remain dependency-ordered. RELEASE-03 verified the retained hosted schema, reconciled the linked ledger to all 16 repository versions without replaying schema SQL, configured the approved production origin, imported the deterministic seed, and deployed the invite-only beta. The [RELEASE-03 evidence](evidence/release-03-hosted-rollout.md) is the authority for exact deployment, smoke, baseline, and rollback state.

The [RELEASE-01 evidence](evidence/release-01-openmidi-identity-reset.md) records the identity reset and preservation boundary. The [RELEASE-02 evidence](evidence/release-02-seeded-beta-hardening.md) records seed preparation, the [RELEASE-03 evidence](evidence/release-03-hosted-rollout.md) records the completed hosted rollout, the [PERF-01 evidence](evidence/perf-01-production-request-fanout.md) records the post-release global-navigation request-fanout control, and the [PERF-02 evidence](evidence/perf-02-content-link-request-fanout.md) records the production-proven dashboard/project-index boundary and measurement contract.

See the tracked [roadmap](../ROADMAP.md) for slice outcomes, ordering, and release gates.

## Hosted cutover boundary

PIVOT-10 retained the existing project reference and local environment binding, replayed the four clean baseline migrations through one linked reset, recreated required administrator/invitation/avatar state, and verified hosted MIDI-only behavior. Later authorized SQL Editor executions brought the schema current and cleared disposable musical data. RELEASE-03 verified each missing version individually and repaired only migration-history status, resulting in a matching 16-entry ledger before deployment.

The retained hosted schema and ledger include `20260719010758_release_01_openmidi_identity_reconciliation.sql`. Repository merges still do not apply migrations automatically: verify the exact target and obtain explicit hosted-mutation authority before any subsequent change. Never repeat the destructive namespace cleanup or broad PIVOT-10 reset.
