# AGENTS.md

This file is the operating contract for coding agents working in this repository. It applies to the entire repository unless a more specific `AGENTS.md` exists deeper in the directory tree.

## Project mission

OpenMIDI is a public MIDI creation, remix, reuse, and constraint-challenge platform for bedroom producers, casual musicians, and learners. Users create versioned MIDI arrangements, edit them in browser workspaces, submit contributions, fork projects, and preserve pattern/revision lineage and attribution.

The target MVP is a Next.js application backed by Supabase Auth/Postgres and avatar-only Storage, with a client-only Tone.js MIDI runtime. PIVOT-10 rebaselined the retained hosted project, and RELEASE-03 verified the current schema, reconciled its linked ledger to all 16 reviewed migrations, imported the approved seed, and deployed the invite-only beta to `https://open-midi.vercel.app/`.

## Read before changing code

Load only the documents relevant to the task, but always use them as the source of truth:

1. Product intent and MVP scope: [`docs/PRD.md`](docs/PRD.md)
2. Delivery sequence, completed slices, and next work: [`docs/ROADMAP.md`](docs/ROADMAP.md)
3. Technical-design index and global invariants: [`docs/technical-design/README.md`](docs/technical-design/README.md)
4. Runtime boundaries and workflows: [`docs/technical-design/01-system-architecture.md`](docs/technical-design/01-system-architecture.md)
5. Schema, storage, RLS, quotas, and retention: [`docs/technical-design/02-data-model.md`](docs/technical-design/02-data-model.md)
6. Milestones, testing, and definition of done: [`docs/technical-design/03-delivery-plan.md`](docs/technical-design/03-delivery-plan.md)
7. Stable architectural decisions: [`docs/technical-design/decisions/README.md`](docs/technical-design/decisions/README.md)
8. Brand, product voice, and visual design for user-facing work: [`docs/design/brand.md`](docs/design/brand.md)
9. Contributor setup and repository map: [`README.md`](README.md)
10. Contribution workflow: [`CONTRIBUTING.md`](CONTRIBUTING.md)
11. MIDI-only vocabulary, persistence, and historical pivot contract: [`docs/technical-design/midi-only-pivot-contract.md`](docs/technical-design/midi-only-pivot-contract.md)
12. Historical Studio-forward sequencing and accepted current-workspace contracts: [`docs/studio-forward-refactor-plan.md`](docs/studio-forward-refactor-plan.md)

If code, task instructions, and these documents disagree, stop and surface the conflict. A user instruction in the active task takes precedence, but update the relevant documentation when it intentionally changes an established decision.

## Current project state

PIVOT-01 through PIVOT-10, the administrator-invitation reconciliation, DIFF-01 through DIFF-03, FEEDBACK-01, LIB-01 through LIB-03, CHALLENGE-01 through CHALLENGE-03, BADGE-01, and RELEASE-01 through RELEASE-03 are complete. Their manifest-v3, presets/runtime, database, Studio, collaboration, public-read, cleanup, hosted-rebaseline, semantic-comparison, beta-feedback, public-library, saved-clip, authorized-reuse, challenge, award, identity-reset, seeded-content, hosted-rollout, hardening, testing, and documentation contracts supersede the historical PR 19/20 and OPT/MIDI/STUDIO delivery sequence without erasing its evidence. The retained hosted schema and ledger contain all 16 reviewed repository versions. npm is the sole package manager and Node.js 24 LTS is required.

Before implementing a task:

- Inspect the repository and nearby code before editing.
- Use `npm` and preserve `package-lock.json`; do not introduce another package manager or lockfile.
- Use Node.js 24. The engine check intentionally rejects other major versions.
- Do not claim tests, lint, type checking, migrations, or builds passed without running the corresponding command.
- Start new work from an up-to-date `master` unless an active handoff names another exact green integration commit.

### MIDI-only foundation authority

- Use the target nouns `MIDI pattern`, `pattern version`, `arrangement version`, `track`, and `clip`. “Stem” is historical/temporary compatibility vocabulary.
- Do not reintroduce uploaded musical media or legacy-audio compatibility; the active application and schema are MIDI-only.
- Public library MIDI has two explicit modes: commercially reusable CC BY 4.0 and reference-only/no-reuse. Reference-only content may be previewed and inspected but not saved, imported, forked, opened as an editable copy, or exported through library actions. Implement library, challenge, and award behavior only in roadmap order and from a dedicated local plan.
- The MVP visual diff is a static combined overlay for any two authorized revisions in one project or any two authorized versions in one pattern history. Match the landing preview's gold `+` Added, coral `~` Changed, and muted dashed `−` Removed language; animated transformation is deferred.
- Public-library listing requires a versioned rights basis and authority attestation for the selected public display/reuse mode. External credits are immutable and separate from verified platform lineage; attribution or reference-only status is not permission, and uncertain-rights covers/recreations cannot enter either public mode. Preserve dedicated copyright-report moderation privacy.
- MVP challenges are administrator-curated. Surface one featured active challenge on the landing/dashboard, keep completed challenge/result pages addressable, and link awards back to their exact result. User-created challenge hosting remains deferred.
- Presets are bundled/versioned synthesis only. Do not add samples, soundfonts, remote audio, or user-supplied synth graphs.
- Historical wave ownership and transition rules remain available in Git history; they are not instructions for new work and should not force the former prelaunch identity to remain in the current tree.

## Authoritative commands

Keep this section exact and runnable from the repository root.

| Purpose                   | Command                          |
| ------------------------- | -------------------------------- |
| Install dependencies      | `npm ci`                         |
| Development server        | `npm run dev`                    |
| Full non-E2E check        | `npm run check`                  |
| MIDI-only static contract | `npm run check:midi-only`        |
| Lint                      | `npm run lint`                   |
| Type check                | `npm run typecheck`              |
| Unit tests                | `npm test`                       |
| Start local Postgres      | `npm run supabase:start`         |
| Start local Auth stack    | `npm run supabase:start:auth`    |
| Start local Storage stack | `npm run supabase:start:storage` |
| Stop local Supabase       | `npm run supabase:stop`          |
| Show local Supabase state | `npm run supabase:status`        |
| Reset/seed local database | `npm run db:reset`               |
| Database lint/tests/types | `npm run db:check`               |
| Database tests            | `npm run db:test`                |
| Generate database types   | `npm run db:types`               |
| Check database type drift | `npm run db:types:check`         |
| Prepare test Auth actor   | `npm run auth:e2e:setup`         |
| Required MIDI E2E suite   | `npm run test:e2e:local`         |
| Avatar E2E                | `npm run test:e2e:avatar`        |
| Identity E2E              | `npm run test:e2e:identity`      |
| Studio smoke E2E          | `npm run test:e2e:studio`        |
| Process profile image     | `npm run avatars:process`        |
| Preview avatar cleanup    | `npm run avatars:cleanup`        |
| Raw/CI end-to-end tests   | `npm run test:e2e`               |
| Production build          | `npm run build`                  |

Never invent a command in a handoff. Read `package.json` and tool configuration, run the narrowest relevant checks during iteration, then run `npm run check` before completion. When routes or browser-visible flows change, run the narrowest applicable local E2E command; use `npm run test:e2e:local` for cross-feature changes. Chromium must be installed once with `npx playwright install chromium`. The raw `npm run test:e2e` command is for an already-configured environment such as CI.

Database commands require a running Docker-compatible container engine. `npm run supabase:start` starts only local Postgres; use the reduced Auth stack for the default MIDI browser suite and the reduced Storage stack only for avatar flows. Reset the database before validating migrations, and stop it when finished. Local E2E reads process-scoped local keys automatically, prepares the gated actor, runs one worker to prevent shared-fixture races, and owns an isolated `.next-e2e` development server that it cleans up on completion or interruption. It requires neither Storage nor Edge Runtime for musical journeys. `npm run db:types` atomically replaces the committed generated file; never edit that file manually. `npm run check` includes the enforceable MIDI-only static contract and remains independent of Docker.

The two-attempt ceiling applies when the same unresolved environment-dependent blocker repeats. A concrete correction to a selector, fixture, test query, or harness defect permits one validation run of the corrected path; do not count that as another attempt at the unchanged blocker, and do not continue looping if the corrected run exposes the same environmental condition.

### Supabase environment contract

`npm run dev` follows the uncommitted `NEXT_PUBLIC_SUPABASE_URL`; it does not switch to local Supabase merely because local containers are running. The retained hosted project and clean local stack both implement the MIDI-only baseline, but they remain independent environments and must be inspected separately when debugging.

Before diagnosing Auth, RPC, RLS, Storage, or missing-data behavior, identify the host in `NEXT_PUBLIC_SUPABASE_URL` without printing keys or credentials. Inspect logs/schema/data in that active environment. A green local database check does not prove hosted parity. Do not apply migrations, seed data, repairs, or destructive commands to any hosted project unless the task explicitly authorizes that external mutation. Never replace hosted values incidentally; use process-scoped local configuration for the documented local flows.

## Non-negotiable architecture rules

- Keep Tone.js and browser audio APIs inside the documented browser-only MIDI runtime boundary.
- The Studio is client-only and lazy-loaded. Tone.js must not be imported by Server Components, server actions, route handlers, proxy, or shared server modules.
- Persist validated manifest-v3 snapshots alongside normalized authoritative arrangement/pattern rows; do not persist live editor objects or rendered audio.
- Published project revisions and submitted contribution versions are immutable.
- Autosave updates a private workspace draft using optimistic concurrency; it does not mutate published history.
- Accepting a contribution creates a new project revision in one transaction. Do not implement automatic musical merging for MVP.
- Forks and reuse are copy-on-write references to immutable pattern and arrangement versions.
- Postgres is the authority for domain relationships and authorization. Storage holds bytes, not business state.
- Profile avatars are the target product's only Storage media. Keep private originals and sanitized public derivatives behind their existing authorization boundary.
- All application-facing tables in exposed schemas have RLS enabled and policy tests. The service-role key is server-only and exceptional, not the normal application data path.
- Email remains in Supabase Auth and must not be copied into publicly selectable profile data.
- Provider metadata is untrusted for public identity; new Auth users begin with incomplete profiles that are not publicly visible.
- Use verified Auth claims/user calls for identity decisions; never authorize from `getSession()` user data. Keep public layouts Auth-independent: shared navigation may progressively enhance display-only account links from verified browser claims, but its signed-out server render must remain usable and it must never become an authorization boundary. Sanitize callback destinations to explicit application-relative routes, and keep test Auth unreachable in production.
- Keep navigation request-bounded: shared-header, authenticated primary-navigation, authenticated dashboard content, and repeated project-index project/Studio links start with prefetch disabled and restore the Next.js default only after pointer or keyboard intent; always-visible shared-footer and affected dashboard/project-index button links remain no-prefetch. Do not extend this rule to public content lists without causal evidence, reintroduce viewport fanout, hide the signed-out-first shell while claims resolve, or turn navigation into an authorization boundary.
- Read public profiles through a safe projection and never expose lifecycle or activity columns through broad base-table selects.
- Store usernames without `@`; render them as `@username`. Normalize and claim usernames atomically in the database.
- Database timestamps are UTC `timestamptz`; serialized application timestamps are ISO 8601 strings.
- Do not expand MVP scope to real-time collaborative editing, automatic audio merging, payments, native applications, or professional-DAW parity without an explicit product decision.

## Repository boundaries

Preserve this implemented shape as the application grows:

```text
src/
  app/                         # routes, layouts, server actions, route handlers
  components/                  # reusable UI primitives
  features/                    # feature-owned UI, domain logic, and tests
    studio/midi-adapter/              # browser-only manifest-v3 editor boundary
  lib/                         # focused cross-feature infrastructure
  server/
    repositories/              # typed persistence access
    services/                  # authorized use cases and transactions
supabase/
  migrations/                  # reviewed forward-only SQL
  seed.sql                     # deterministic local/demo data
tests/e2e/
docs/
```

Feature-specific code stays with its feature. Do not create generic dumping grounds such as `utils.ts`, `helpers.ts`, or an unbounded `shared/` directory. Promote code only after a real second consumer exists.

## Implementation workflow

For each task:

1. Restate the outcome and identify the relevant PRD/design sections.
2. Inspect nearby code, migrations, tests, and current working-tree changes before editing.
3. Call out any assumption that changes product behavior, authorization, schema, storage usage, licensing posture, or persisted format.
4. Implement the smallest vertical behavior that satisfies the task.
5. Add or update tests at the layer where the behavior is owned.
6. Run focused checks, then the repository’s required completion checks.
7. Review the diff for accidental generated files, secrets, unrelated formatting, and documentation drift.
8. Hand off the outcome, verification performed, known limitations, and any migration/deployment ordering.

Prefer a working vertical slice over speculative abstraction. Do not silently repair unrelated issues or reformat unrelated files. Preserve user changes in a dirty working tree.

### Orchestrated top-level implementation tasks

When the user asks the current planner/orchestrator task for a prompt to start an implementation worker, use this repository-default workflow unless the user explicitly asks for a copyable prompt only:

1. Draft the proposed worker scope internally, summarize what will be delegated, and ask the user for explicit approval before creating anything. Do not create a task from the initial prompt request alone.
2. After approval, create a separate top-level Codex task for this saved project in an isolated worktree. Do not use a collaboration subagent for the implementation. Start from the repository default branch unless the accepted plan or user names another exact green starting state.
3. Include the orchestrator task's exact thread ID in the worker prompt. Require the worker to use the Codex top-level task messaging tool to notify that orchestrator directly; a final response visible only inside the worker task is not a sufficient handoff.
4. The worker sends an event to the orchestrator only when:
   - a genuine blocker requires user or planner direction after safe in-scope alternatives are exhausted;
   - implementation is committed, pushed, and a PR is open and ready for orchestrator review; or
   - requested review repairs have been completed and pushed for re-review.
5. The orchestrator sends messages to the worker only for the initial assignment or concrete requested repairs/clarifications. Neither task polls the other, repeatedly reads unchanged task state, or sends status-check messages. The worker's direct completion/blocker message is the event that resumes orchestration.
6. On a completion event, the orchestrator reviews the actual PR, diff, migration contract, tests, and current CI state. If changes are needed, send one focused repair request to the same worker task and wait for its next completion event. Do not create a replacement worker for ordinary review fixes.
7. When the work meets the plan, return to the user in the orchestrator task with the actual commit message(s), PR title, PR body, PR URL, verification results, and any required migration/deployment handoff. Do not merge unless the user separately authorizes merging.
8. If the user declines task creation, provide the copyable prompt instead. If top-level task tooling is unavailable, explain that limitation and fall back to the prompt without silently substituting a subagent.

For a PR containing a hosted migration, the worker must stop at the repository's user-operated migration gate and message the orchestrator with the exact reviewed migration handoff. The orchestrator reviews it before asking the user to run SQL. The PR remains unmerged until the user confirms the required SQL Editor execution, postflight, and linked migration-history reconciliation.

## TypeScript and Next.js conventions

- Use TypeScript strict mode. Avoid `any`; validate `unknown` at trust boundaries.
- Prefer Server Components. Add `"use client"` only at the smallest interactive boundary.
- Keep browser-only and server-only dependency graphs visibly separate.
- While Next.js 16.2.10 is pinned, do not add a `loading.tsx` at `src/app/projects/[projectId]` or its studio segment. The removed boundary triggered an upstream Firefox development streaming bug (`vercel/next.js#94128`) that hard-refreshed the studio indefinitely. Reconsider only during a deliberate Next.js upgrade with a focused Firefox navigation check.
- Validate server-action and route-handler inputs with shared runtime schemas. TypeScript types alone are not validation.
- Domain types are smaller than database row types. Map `snake_case` database records to `camelCase` domain objects at the repository boundary.
- Generate Supabase database types from the actual schema; do not hand-maintain a duplicate schema interface or edit generated output manually.
- Use server actions for small same-origin mutations and route handlers for callbacks, upload coordination, or stable HTTP contracts.
- Authorization belongs in service/data boundaries, not middleware or hidden UI controls.
- Use Tailwind for styling and Motion for purposeful state/transition feedback. Respect reduced-motion preferences and keep core behavior usable without animation.
- User-facing surfaces must follow [`docs/design/brand.md`](docs/design/brand.md): use the shared semantic tokens and established component patterns, keep product copy warm and musician-focused, and use pill-shaped shared buttons consistent with the landing page. Do not introduce raw palette values or a competing visual system.
- Use accessible semantic controls and keyboard interactions, especially for playback and mixer functions.

## Database and migration rules

- Schema changes require a forward-only SQL migration and affected RLS/integration tests in the same change.
- Never change an already-applied migration to alter current behavior. RELEASE-01 is a user-authorized one-time prelaunch exception: update the clean migration source to the OpenMIDI namespace for fresh installs and add a forward reconciliation migration for the retained hosted project in the same change. After RELEASE-01, the resulting baseline and every forward migration are immutable again.
- Use expand/migrate/contract for destructive or incompatible changes unless the accepted clean-baseline pivot contract explicitly removes that need.
- Index foreign keys used for relationship checks and indexes required by measured query patterns. Avoid speculative indexing.
- Use constraints for durable invariants and transactions/database functions for multi-row state transitions.
- Security-definer functions must set a safe `search_path`, authorize `auth.uid()`, and expose only the minimum required execute permission.
- Deny direct application updates to immutable revisions and lifecycle fields controlled by commands.
- JSONB manifests require an explicit version and runtime validation. Do not hide queryable relationships inside JSONB.
- Seed data is deterministic, non-sensitive, and safe to reset locally.

For every RLS-sensitive feature, test at least: anonymous user, resource author, unrelated authenticated user, project owner/reviewer, and suspended user where applicable.

## Storage and MIDI runtime rules

- Do not add musical-file uploads, source-audio assets, samples, soundfonts, server-stored previews, or server-rendered audio.
- MIDI import is parsed and validated as structured data; MIDI export and synthesized audio render remain browser-local downloads.
- Presets are bundled, deterministic, versioned Tone.js synthesis definitions. Published arrangements pin exact preset versions.
- Profile-avatar originals remain private and derivatives sanitized; signed URLs and object paths must never be logged.
- Active musical routes, schema, workers, environment instructions, and current-behavior documentation must remain free of legacy audio infrastructure; `npm run check:midi-only` enforces this boundary.
- Changes to Tone.js versions, preset definitions, or manifest schemas require deterministic round-trip/runtime fixtures for every supported persisted version.

## Security, privacy, and moderation

- Never commit secrets or place service-role credentials in browser-exposed environment variables.
- Avoid logging tokens, cookies, signed URLs, user audio, complete manifests, or sensitive report content.
- Rate-limit auth-adjacent actions, uploads, project creation, contribution submission, reporting, and search abuse points.
- Treat project descriptions and other user content as untrusted. Use plain text or an explicitly sanitized restricted Markdown renderer.
- Reporting alone does not hide content; only a recorded moderator action changes visibility.
- Rejected contributions are visible only to their author and the project owner and are excluded from public discovery.
- Do not weaken access control or retention behavior for demo convenience.

## Testing expectations

Tests should prove behavior, not implementation details:

- Unit tests for deterministic domain logic, manifest mapping/versioning, validation, and state machines.
- Local-Supabase integration tests for RLS, transactions, constraints, concurrency, and retention/reference behavior.
- Browser tests for critical user journeys: authentication/onboarding, MIDI creation/import, synchronized playback, save/reload, publication, contribution review, acceptance, and fork lineage.
- Contract fixtures for manifest-v3 normalized round trips and the browser-only MIDI runtime mapping.

Mock external boundaries only when the real local dependency is impractical. Do not mock Postgres/RLS in tests intended to establish authorization correctness. Synthesized playback behavior requiring perception or browser capability should include a documented manual check alongside automated structural assertions.

## Dependency and licensing discipline

- Add a dependency only when the platform or existing stack cannot reasonably provide the capability.
- Pin direct Tone.js packages exactly; upgrades are deliberate tasks with preset and persisted-fixture validation.
- Preserve third-party notices and attribution. Do not copy upstream demo media or assets without verified redistribution terms.
- OpenDAW is post-MVP and must not be introduced without a superseding ADR, integration plan, persisted-format compatibility plan, and licensing review.
- Do not replace lockfiles, package managers, linting, formatting, or test frameworks incidentally.

## Git and review hygiene

- Keep changes focused and reviewable. Separate schema, generated artifacts, and unrelated refactors when practical.
- Do not discard, overwrite, or stage unrelated user changes.
- Do not use destructive Git commands unless explicitly requested.
- Never commit `.env*`, credentials, local Supabase state, uploaded media, build output, or editor-specific files.
- Generated database types are committed and must change with the migration that changes them; identify generated output clearly in review.
- Update docs or add a superseding ADR when a stable architectural decision changes.

## Definition of done

A task is complete only when:

- The requested behavior and documented acceptance criteria are satisfied.
- Relevant allowed and denied authorization paths are covered.
- Applicable lint, type, unit, integration, E2E, and production-build checks pass—or unavailable checks are explicitly reported as unavailable.
- Migrations apply from a clean local database and generated types are current when the schema changes.
- Errors are actionable and logs contain no sensitive payloads.
- Accessibility, loading, and storage implications have been considered proportionally to the change.
- Documentation reflects intentional changes to persisted formats, behavior, commands, or architecture.

## When to stop and ask

Ask for direction before proceeding when a task requires:

- A product decision not answered by the PRD/design documents.
- A destructive migration or irreversible deletion outside established retention policy.
- Weaker RLS, public private-media access, service-role use in normal requests, or a new external data processor.
- A change to immutable history, fork lineage, contribution acceptance semantics, or persisted manifest compatibility.
- Introducing OpenDAW or another browser editor outside the accepted adapter/ADR boundary.
- A materially different stack, package manager, hosting provider, database, or authentication provider.

Otherwise, make the smallest reasonable documented assumption and continue.
