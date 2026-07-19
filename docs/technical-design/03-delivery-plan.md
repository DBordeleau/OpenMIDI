# Delivery plan and verification

Status: MIDI-only foundation through RELEASE-02 complete; hosted schema current, linked migration ledger unverified, and Vercel deployment deferred

## Implemented foundation

PIVOT-01 through PIVOT-10 and the final administrator-invitation reconciliation delivered the manifest-v3 domain, deterministic semantic diff, bundled preset runtime, normalized Postgres model, Studio and collaboration cutovers, public reads, application/Supabase cleanup, clean migration baseline, hosted rehearsal, deterministic testing, and documentation reconciliation.

The historical PR 01–20, OPT-01–OPT-05, MIDI-01–MIDI-07, and STUDIO-01–STUDIO-06 plans explain how the repository reached the pivot. They are superseded sequencing and must not be used as current environment, migration, or deployment instructions.

## Normal implementation gates

1. Inspect the relevant authority and nearby code.
2. Run the narrowest unit, pgTAP, or browser path while iterating.
3. Run `npm run check`; it includes formatting, lint, strict types, unit tests, production build, and the MIDI-only static contract.
4. For schema work, start local Postgres, run one clean `npm run db:reset`, `npm run db:check`, regenerate types atomically when needed, and stop Supabase.
5. For cross-feature browser behavior, start the reduced Auth stack and run `npm run test:e2e:local` once. The default path covers identity, MIDI Studio save/publish/preview, contribution acceptance, and fork lineage without Storage or Edge Runtime.
6. Run `git diff --check` and review generated artifacts, secrets, and unrelated changes.

The two-attempt ceiling applies to an unchanged environment blocker. A concrete fixture, selector, query, or harness correction permits one validation run of the corrected path.

## Post-pivot MVP sequence

DIFF-01 through DIFF-03, FEEDBACK-01, LIB-01 through LIB-03, CHALLENGE-01 through CHALLENGE-03, BADGE-01, RELEASE-01, and RELEASE-02 are complete. RELEASE-03 is next but remains unauthorized.

1. **Wave A — DIFF and FEEDBACK:** complete with landing-matched static semantic comparisons for authorized revision pairs plus authenticated beta feedback and a private administrator queue.
2. **Wave B — LIB:** complete with rights-gated public pattern listing, commercially reusable and reference-only modes, All/mode Explore filtering, external credits, copyright reporting/moderation, bounded musical search/filtering, browser-local preview/export, any-two-version history diffs, private saved clips, and attributed reusable-only save/import/fork/editor actions.
3. **Wave C — CHALLENGE:** complete with administrator-curated immutable versions, time-derived phases, authoritative eligibility, exact entries, private serialized voting, popularity-independent rotation, private reports, optimistic moderation, append-only permanent results/corrections, all favorite ties, and canonical featured discovery.
4. **Wave D — BADGE:** complete with a versioned bounded catalog, transactional exact-current-result issuance, immutable correction evidence, serialized reconciliation, and safe profile cards linking to permanent result/entry context.
5. **Wave E — RELEASE:** RELEASE-01 identity reconciliation and RELEASE-02 seeded-beta hardening are complete; configure providers, import the approved hosted seed, deploy Vercel, and run production smoke only in authorized RELEASE-03.

Library, challenge, badge, and release slices are dependency-ordered. The retained hosted schema implements all reviewed changes through the corrected RELEASE-01 reconciliation, but the later SQL Editor executions may not be represented by all 16 repository versions in the linked migration ledger. RELEASE-02 prepared deterministic seed fixtures, operator tooling, hardening evidence, and runbooks without hosted mutation. RELEASE-03 must first verify and, if needed, reconcile the linked ledger through a reviewed authorized procedure; only then may it change external OAuth/Supabase/Vercel configuration, execute the approved hosted beta import, deploy, or run production smoke—and only after explicit authority.

The [RELEASE-01 evidence](evidence/release-01-openmidi-identity-reset.md) records the current checkpoint, exact reconciliation migration, preservation boundary, and deferred hosted rollout. The detailed ignored release plan sequences RELEASE-02 next.

See the tracked [roadmap](../ROADMAP.md) for slice outcomes, ordering, and release gates.

## Hosted cutover boundary

PIVOT-10 retained the existing project reference and local environment binding, replayed the four clean baseline migrations through one linked reset, recreated required administrator/invitation/avatar state, and verified hosted MIDI-only behavior. The later authorized LIB, CHALLENGE, BADGE, and corrected RELEASE-01 SQL Editor executions brought the hosted schema current and cleared disposable musical data; they did not establish a 16-entry linked ledger. Vercel deployment and its production smoke path remain deferred.

The retained hosted schema includes the behavior of `20260719010758_release_01_openmidi_identity_reconciliation.sql`, but the linked migration ledger must be inspected before claiming that version is recorded. Repository merges still do not apply migrations automatically: verify the exact target and obtain explicit hosted-mutation authority before any subsequent change. RELEASE-03 must compare schema and ledger state, reconcile missing history only through a reviewed non-schema procedure, and never repeat the destructive namespace cleanup or broad PIVOT-10 reset.
