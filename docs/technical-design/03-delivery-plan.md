# Delivery plan and verification

Status: MIDI-only foundation, semantic visual diff, feedback, LIB-01 through LIB-03, and CHALLENGE-01 complete in repository; five post-hosted migrations and Vercel deployment deferred

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

DIFF-01 through DIFF-03, FEEDBACK-01, LIB-01 through LIB-03, and CHALLENGE-01 are complete in the repository. CHALLENGE-02 is next from the worker-ready local plan, grounded in the merged immutable challenge lifecycle authority.

1. **Wave A — DIFF and FEEDBACK:** complete with landing-matched static semantic comparisons for authorized revision pairs plus authenticated beta feedback and a private administrator queue.
2. **Wave B — LIB:** complete with rights-gated public pattern listing, commercially reusable and reference-only modes, All/mode Explore filtering, external credits, copyright reporting/moderation, bounded musical search/filtering, browser-local preview/export, any-two-version history diffs, private saved clips, and attributed reusable-only save/import/fork/editor actions.
3. **Wave C — CHALLENGE:** CHALLENGE-01 is complete with administrator-curated immutable challenge versions, time-derived phases, audited commands, and bounded public/admin routes. Next implement deterministic preflight, authoritative immutable entries, and explicit replacement in CHALLENGE-02; voting, moderation, featured discovery, and permanently addressable finalized results follow in CHALLENGE-03.
4. **Wave D — BADGE:** derive extensible immutable profile awards from finalized challenge results and link every award to its canonical completed challenge/result.
5. **Wave E — RELEASE:** coordinate the OpenMIDI frontend/repository rename, seed useful beta content, harden critical paths, configure Vercel, and run production smoke checks.

DIFF and FEEDBACK are the only parallel-safe product programs by default. Library, challenge, badge, and release slices are dependency-ordered. Detailed worker plans must declare any narrower parallel ownership before branches start.

See the tracked [roadmap](../ROADMAP.md) for slice outcomes, ordering, and release gates.

## Hosted cutover boundary

PIVOT-10 completed the only authorized destructive mutation of the hosted Supabase project. It retained the existing project reference and local environment binding, replayed exactly four clean migrations through one linked reset, recreated required administrator/invitation/avatar state, and verified hosted MIDI-only behavior. Vercel deployment and its production smoke path are explicitly deferred until the user chooses to deploy; they are not a PIVOT-10 failure.

The final `master` reconciliation added administrator-managed beta invitations as forward migration `20260717142701`; it is recorded in the retained hosted project after the four baseline migrations. Future repository merges still do not apply migrations automatically: verify the exact target and obtain explicit hosted-mutation authority before pushing any subsequent migration. Do not rerun the destructive PIVOT-10 reset.
