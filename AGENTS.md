# AGENTS.md

This file is the operating contract for coding agents working in this repository. It applies to the entire repository unless a more specific `AGENTS.md` exists deeper in the directory tree.

## Project mission

Jam Session is an asynchronous music-collaboration platform inspired by Git and GitHub. Users create versioned MIDI arrangements and compatible legacy-audio projects, edit them in browser workspaces, submit contributions for review, and fork projects while preserving history and attribution.

The MVP is a Next.js application backed by Supabase Auth, Postgres, and Storage, with its composite MIDI/audio runtime isolated behind a browser-only integration boundary. It will eventually deploy to Vercel.

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
11. Studio-forward sequencing and accepted workspace contracts: [`docs/studio-forward-refactor-plan.md`](docs/studio-forward-refactor-plan.md)

If code, task instructions, and these documents disagree, stop and surface the conflict. A user instruction in the active task takes precedence, but update the relevant documentation when it intentionally changes an established decision.

## Current project state

PRs 01–17, OPT-01–OPT-05, MIDI-01–MIDI-07, and STUDIO-01 are implemented. In addition to the complete collaboration/discovery and optimized legacy-audio foundation, executable MIDI stem/manifest/session/scheduler contracts, sample-free preset v1, owner-only conflict-safe MIDI stem drafts, the standalone My stems foundation, Signal-derived accessible piano-roll editing and recording, immutable credited stem versions, browser-only Standard MIDI interchange, exact-version Studio import/publish/preview/export, MIDI contribution/acceptance/credit/fork paths, the tested reversible source-admission capability, and the canonical project-independent Studio shell/routes are in place. STUDIO-02 is next, followed by STUDIO-03–STUDIO-06 and then PR 18. Studio—not the standalone editor—is the target primary MIDI creation/recording/arrangement surface; standalone routes remain shared-component library/alternate surfaces. Source audio remains private and participant-scoped even for public projects; new source admission remains enabled until the STUDIO-06 Studio-native parity gate. User upload history intentionally excludes internal workspace snapshots. Moderation/retention operations and release hardening are not implemented. npm is the sole package manager and Node.js 24 LTS is required.

Before implementing a task:

- Inspect the repository and nearby code before editing.
- Use `npm` and preserve `package-lock.json`; do not introduce another package manager or lockfile.
- Use Node.js 24. The engine check intentionally rejects other major versions.
- Do not claim tests, lint, type checking, migrations, or builds passed without running the corresponding command.

## Authoritative commands

Keep this section exact and runnable from the repository root.

| Purpose                   | Command                          |
| ------------------------- | -------------------------------- |
| Install dependencies      | `npm ci`                         |
| Development server        | `npm run dev`                    |
| Full non-E2E check        | `npm run check`                  |
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
| Local E2E suite           | `npm run test:e2e:local`         |
| Identity E2E              | `npm run test:e2e:identity`      |
| Studio smoke E2E          | `npm run test:e2e:studio`        |
| Upload optimization E2E   | `npm run test:e2e:upload`        |
| Verify source asset       | `npm run assets:verify`          |
| Preview asset cleanup     | `npm run assets:cleanup`         |
| Process profile image     | `npm run avatars:process`        |
| Preview avatar cleanup    | `npm run avatars:cleanup`        |
| Raw/CI end-to-end tests   | `npm run test:e2e`               |
| Production build          | `npm run build`                  |

Never invent a command in a handoff. Read `package.json` and tool configuration, run the narrowest relevant checks during iteration, then run `npm run check` before completion. When routes or browser-visible flows change, run the narrowest applicable local E2E command; use `npm run test:e2e:local` for cross-feature changes. Chromium must be installed once with `npx playwright install chromium`. The raw `npm run test:e2e` command is for an already-configured environment such as CI.

Database commands require a running Docker-compatible container engine. `npm run supabase:start` starts only local Postgres; use the reduced Auth or Storage stack commands for their corresponding browser flows. Reset the database before validating migrations, and stop it when finished. Local E2E uses the Storage stack, reads its process-scoped keys automatically, prepares the gated actor, runs one worker to prevent shared-fixture races, and owns an isolated `.next-e2e` development server that it cleans up on completion or interruption. Its upload journey completes the real verification lease and credit-confirmation state deterministically because the reduced stack intentionally omits Edge Runtime. `npm run db:types` atomically replaces the committed generated file; never edit that file manually. Source verification is normally automatic; `npm run assets:verify` is a trusted lease-aware operator fallback, never browser authority. `npm run check` intentionally remains independent of Docker.

The two-attempt ceiling applies when the same unresolved environment-dependent blocker repeats. A concrete correction to a selector, fixture, test query, or harness defect permits one validation run of the corrected path; do not count that as another attempt at the unchanged blocker, and do not continue looping if the corrected run exposes the same environmental condition.

### Supabase environment contract

The normal interactive development app intentionally uses the actual hosted Supabase project configured in the uncommitted `.env.local`. `npm run dev` follows `NEXT_PUBLIC_SUPABASE_URL`; it does not switch to local Supabase merely because local containers are running. The local Supabase stack exists primarily for clean migration resets, pgTAP/RLS tests, generated types, deterministic fixtures, and explicitly requested local Auth/Storage browser flows.

Before diagnosing Auth, RPC, RLS, Storage, or missing-data behavior, identify the host in `NEXT_PUBLIC_SUPABASE_URL` without printing keys or credentials. Inspect logs/schema/data in that active environment. A green local database check does not prove that the hosted schema is current, and an empty local table does not prove that a hosted request failed before persistence. Conversely, do not apply migrations, seed data, repairs, or destructive commands to the hosted project unless the task explicitly authorizes that external mutation. Never replace the hosted `.env.local` with local values as an incidental debugging step.

## Non-negotiable architecture rules

- Keep Waveform Playlist, Tone.js, and browser audio APIs inside `src/features/studio/waveform-playlist-adapter` or its documented successor.
- The studio is client-only and lazy-loaded. Editor/audio packages must not be imported by Server Components, server actions, route handlers, proxy, or shared server modules.
- Persist a validated, versioned Jam Session manifest as the MVP workspace authority; do not persist live editor objects or decoded audio.
- Published project revisions and submitted contribution versions are immutable.
- Autosave updates a private workspace draft using optimistic concurrency; it does not mutate published history.
- Accepting a contribution creates a new project revision in one transaction. Do not implement automatic merging of divergent audio arrangements for MVP.
- Forks are copy-on-write references to immutable assets. Do not duplicate source audio merely because a project is forked.
- Postgres is the authority for domain relationships and authorization. Storage holds bytes, not business state.
- Audio, snapshots, and derived files use server-generated asset IDs and private buckets. Do not make a bucket public as an authorization shortcut.
- All application-facing tables in exposed schemas have RLS enabled and policy tests. The service-role key is server-only and exceptional, not the normal application data path.
- Email remains in Supabase Auth and must not be copied into publicly selectable profile data.
- Provider metadata is untrusted for public identity; new Auth users begin with incomplete profiles that are not publicly visible.
- Use verified Auth claims/user calls for identity decisions; never authorize from `getSession()` user data. Keep public layouts Auth-independent: shared navigation may progressively enhance display-only account links from verified browser claims, but its signed-out server render must remain usable and it must never become an authorization boundary. Sanitize callback destinations to explicit application-relative routes, and keep test Auth unreachable in production.
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
    studio/waveform-playlist-adapter/ # sole browser editor/audio dependency boundary
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
- Never change an already-applied migration to alter production behavior; create a new migration.
- Use expand/migrate/contract for destructive or incompatible changes.
- Index foreign keys used for relationship checks and indexes required by measured query patterns. Avoid speculative indexing.
- Use constraints for durable invariants and transactions/database functions for multi-row state transitions.
- Security-definer functions must set a safe `search_path`, authorize `auth.uid()`, and expose only the minimum required execute permission.
- Deny direct application updates to immutable revisions and lifecycle fields controlled by commands.
- JSONB manifests require an explicit version and runtime validation. Do not hide queryable relationships inside JSONB.
- Seed data is deterministic, non-sensitive, and safe to reset locally.

For every RLS-sensitive feature, test at least: anonymous user, resource author, unrelated authenticated user, project owner/reviewer, and suspended user where applicable.

## Storage and audio rules

- Accepted MVP source formats are WAV, FLAC, and MP3. Verify file signature and decoded media metadata; never trust filename or client MIME alone.
- Current limits are 45 MiB and 10 minutes per audio file, 12 stems and 250 MiB per project, 200 MiB per user, and an 850 MiB global soft stop.
- Upload large files directly and resumably to Supabase Storage; do not proxy audio bytes through a Vercel Function.
- Source assets are immutable. Replacing audio creates a new asset ID.
- User-facing upload history lists only `source_audio`; workspace snapshots and other internal/derived asset kinds must not appear as uploads.
- Quotas count uniquely stored source assets, not revision or fork references.
- Signed URLs are short-lived and must never be logged.
- Asset deletion is reference-aware and follows the documented retention/legal-hold rules.
- Changes to Waveform Playlist/Tone.js versions or manifest schemas require deterministic round-trip fixture tests for every supported persisted version.

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
- Browser tests for critical user journeys: authentication/onboarding, upload, synchronized playback, save/reload, contribution review, acceptance, and fork lineage.
- Contract fixtures for Jam Session manifests and their Waveform Playlist adapter mapping.

Mock external boundaries only when the real local dependency is impractical. Do not mock Postgres/RLS in tests intended to establish authorization correctness. Audio behavior requiring perception or browser capability should include a documented manual check alongside automated structural assertions.

## Dependency and licensing discipline

- Add a dependency only when the platform or existing stack cannot reasonably provide the capability.
- Pin Waveform Playlist and direct Tone.js packages exactly until compatibility policy is established; upgrades are deliberate tasks with fixture validation.
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
- Weaker RLS, public source-audio access, service-role use in normal requests, or a new external data processor.
- A change to immutable history, fork lineage, contribution acceptance semantics, or persisted manifest compatibility.
- Introducing OpenDAW or another browser editor outside the accepted adapter/ADR boundary.
- A materially different stack, package manager, hosting provider, database, or authentication provider.

Otherwise, make the smallest reasonable documented assumption and continue.
