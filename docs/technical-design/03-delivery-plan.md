# Delivery plan and verification

Status: PIVOT-10 same-project hosted rebaseline complete; Vercel deployment deferred

## Implemented foundation

PIVOT-01 through PIVOT-10 delivered the manifest-v3 domain, deterministic semantic diff, bundled preset runtime, normalized Postgres model, Studio and collaboration cutovers, public reads, application/Supabase cleanup, clean migration baseline, hosted rehearsal, deterministic testing, and documentation reconciliation.

The historical PR 01–20, OPT-01–OPT-05, MIDI-01–MIDI-07, and STUDIO-01–STUDIO-06 plans explain how the repository reached the pivot. They are superseded sequencing and must not be used as current environment, migration, or deployment instructions.

## Normal implementation gates

1. Inspect the relevant authority and nearby code.
2. Run the narrowest unit, pgTAP, or browser path while iterating.
3. Run `npm run check`; it includes formatting, lint, strict types, unit tests, production build, and the MIDI-only static contract.
4. For schema work, start local Postgres, run one clean `npm run db:reset`, `npm run db:check`, regenerate types atomically when needed, and stop Supabase.
5. For cross-feature browser behavior, start the reduced Auth stack and run `npm run test:e2e:local` once. The default path covers identity, MIDI Studio save/publish/preview, contribution acceptance, and fork lineage without Storage or Edge Runtime.
6. Run `git diff --check` and review generated artifacts, secrets, and unrelated changes.

The two-attempt ceiling applies to an unchanged environment blocker. A concrete fixture, selector, query, or harness correction permits one validation run of the corrected path.

## Next product slices

1. Semantic visual diffs become the musician-facing review surface.
2. The public MIDI pattern library adds explicit listing, search, preview, reuse, and lineage.
3. Challenges add versioned rules and validation snapshots over exact immutable revisions.

See the tracked [roadmap](../ROADMAP.md) for outcomes and ordering.

## Hosted cutover boundary

PIVOT-10 completed the only authorized destructive mutation of the hosted Supabase project. It retained the existing project reference and local environment binding, replayed exactly four clean migrations through one linked reset, recreated required administrator/invitation/avatar state, and verified hosted MIDI-only behavior. Vercel deployment and its production smoke path are explicitly deferred until the user chooses to deploy; they are not a PIVOT-10 failure.
