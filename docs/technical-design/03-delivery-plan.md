# Delivery plan and verification

Status: MIDI-only foundation through RELEASE-01 complete in repository; nine post-hosted migrations and Vercel deployment deferred

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

DIFF-01 through DIFF-03, FEEDBACK-01, LIB-01 through LIB-03, CHALLENGE-01 through CHALLENGE-03, BADGE-01, and RELEASE-01 are complete in the repository. RELEASE-02 is next.

1. **Wave A — DIFF and FEEDBACK:** complete with landing-matched static semantic comparisons for authorized revision pairs plus authenticated beta feedback and a private administrator queue.
2. **Wave B — LIB:** complete with rights-gated public pattern listing, commercially reusable and reference-only modes, All/mode Explore filtering, external credits, copyright reporting/moderation, bounded musical search/filtering, browser-local preview/export, any-two-version history diffs, private saved clips, and attributed reusable-only save/import/fork/editor actions.
3. **Wave C — CHALLENGE:** complete with administrator-curated immutable versions, time-derived phases, authoritative eligibility, exact entries, private serialized voting, popularity-independent rotation, private reports, optimistic moderation, append-only permanent results/corrections, all favorite ties, and canonical featured discovery.
4. **Wave D — BADGE:** complete with a versioned bounded catalog, transactional exact-current-result issuance, immutable correction evidence, serialized reconciliation, and safe profile cards linking to permanent result/entry context.
5. **Wave E — RELEASE:** RELEASE-01 identity reset is complete; next seed useful beta content and harden critical paths in RELEASE-02, then configure Vercel and run production smoke checks only in authorized RELEASE-03.

DIFF and FEEDBACK are the only parallel-safe product programs by default. Library, challenge, badge, and release slices are dependency-ordered. RELEASE-01 is repository-only and must land before RELEASE-02; its one-time prelaunch identity reset may rewrite clean migration source, add a forward namespace-reconciliation migration, and invalidate local musical fixtures. RELEASE-02 prepares deterministic seed fixtures, operator tooling, and hardening evidence without mutating hosted production data. RELEASE-03 alone may delete existing hosted musical domain data, apply the namespace reconciliation and other reviewed pending migrations, change external OAuth/Supabase/Vercel configuration, seed hosted beta content, or deploy—and only after explicit authority. Research and checklist preparation may run in parallel, but shared application, metadata, migration, seed, generated-type, and release-runbook ownership stays sequential.

The [RELEASE-01 evidence](evidence/release-01-openmidi-identity-reset.md) records the current checkpoint, exact reconciliation migration, preservation boundary, and deferred hosted rollout. The detailed ignored release plan sequences RELEASE-02 next.

See the tracked [roadmap](../ROADMAP.md) for slice outcomes, ordering, and release gates.

## Hosted cutover boundary

PIVOT-10 completed the only authorized destructive mutation of the hosted Supabase project. It retained the existing project reference and local environment binding, replayed exactly four clean migrations through one linked reset, recreated required administrator/invitation/avatar state, and verified hosted MIDI-only behavior. Vercel deployment and its production smoke path are explicitly deferred until the user chooses to deploy; they are not a PIVOT-10 failure.

The final `master` reconciliation added administrator-managed beta invitations as forward migration `20260717142701`; it is recorded in the retained hosted project after the four baseline migrations. Repository merges still do not apply migrations automatically: verify the exact target and obtain explicit hosted-mutation authority before pushing any subsequent migration. RELEASE-03 may run the reviewed forward namespace reconciliation and delete existing musical domain data, but it must retain the same Supabase project/reference and must not rerun the broad PIVOT-10 project reset.
