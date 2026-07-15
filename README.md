# Jam Session

Jam Session is an asynchronous music-collaboration platform inspired by Git and open-source development. Musicians create projects from reusable MIDI stems and compatible legacy audio, preserve immutable revision history, propose contributions with durable attribution, and create copy-on-write forks with navigable lineage.

> **Current status:** PRs 01–17, the five-slice $0 audio-delivery optimization, MIDI-01–MIDI-07, and STUDIO-01–STUDIO-03 are complete. The repository includes frozen MIDI/manifest/session contracts, deterministic sample-free presets, accessible My stems composition/recording, immutable versions, exact project import/publication/preview/export, complete MIDI collaboration paths, a tested reversible source-admission control that remains enabled, the canonical project-independent Studio shell with bounded browsing, creation, and recovery-safe switching, and a unified audio/MIDI arranger visualization. STUDIO-04 is next; the remaining studio-forward slices add arrangement mutation, integrated piano-roll recording, and the final parity/audio-lock gate before PR 18 resumes.

## Target MVP scope

- Create, record, and edit reusable MIDI stems inside Studio, with My stems and standalone routes retained for library/alternate access.
- Arrange and mix MIDI plus compatible legacy audio on one shared browser timeline.
- Preserve authorized existing audio while disabling new source admission only after the Studio-native MIDI parity gate.
- Submit a contribution for the project owner to review.
- Accept or reject contributions without rewriting project history.
- Fork a project while preserving its source and contributor credits.
- Discover public projects by musical metadata.

The [product requirements](docs/PRD.md) describe the intended experience, the tracked [MVP roadmap](docs/ROADMAP.md) shows what is complete and what comes next, the [technical-design index](docs/technical-design/README.md) explains how it is built, the [studio-forward plan](docs/studio-forward-refactor-plan.md) fixes the future Studio contracts and slice boundaries, and the [brand and visual-design guide](docs/design/brand.md) defines the product voice and presentation for user-facing surfaces.

## Technology

- [Next.js](https://nextjs.org/) App Router and TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Motion for React](https://motion.dev/docs/react) (formerly Framer Motion) for purposeful interaction animation
- [Supabase](https://supabase.com/) for Postgres, invite-only Google Auth, and private Storage
- [Waveform Playlist](https://github.com/naomiaro/waveform-playlist) behind a production client-only adapter for synchronized playback
- [Vitest](https://vitest.dev/) and React Testing Library for unit/component tests
- [Playwright](https://playwright.dev/) for browser tests
- Vercel for eventual deployment

## Prerequisites

You need:

1. [Git](https://git-scm.com/downloads)
2. [Node.js 24 LTS](https://nodejs.org/en/download) — npm is included with Node
3. [Docker Desktop](https://www.docker.com/products/docker-desktop/) or another Docker-compatible container engine for database work
4. A code editor such as [Visual Studio Code](https://code.visualstudio.com/)

Docker is not needed for frontend-only commands, including `npm run dev` and `npm run check`. The Supabase CLI is installed by `npm ci`; do not install an unpinned global copy.

After installing, open a new terminal and verify:

```text
node --version
npm --version
git --version
```

`node --version` should begin with `v24`. This repository deliberately rejects other Node major versions so every contributor uses the same runtime baseline.

## First-time setup on Windows

These instructions use PowerShell, which is included with Windows.

1. Install Git using the Git installer linked above. The default installer settings are fine.
2. Install the Node.js 24 LTS Windows installer from the official Node website.
3. Close and reopen PowerShell so it can find the new programs.
4. Clone the repository and enter its directory:

   ```powershell
   git clone <repository-url>
   cd JamSession
   ```

5. Install the exact dependencies recorded in `package-lock.json`:

   ```powershell
   npm ci
   ```

6. Start the development server:

   ```powershell
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.
8. Stop the server by returning to PowerShell and pressing `Ctrl+C`.

There is no virtual environment to activate. Node projects keep their dependencies in the local `node_modules` directory, which `npm ci` creates for you.

## First-time setup on macOS or Linux

Install Git and Node.js 24 LTS. A Node version manager is recommended if you work on multiple Node projects, but it is not required. This repository includes both `.nvmrc` and `.node-version` files for compatible version managers.

Then run:

```bash
git clone <repository-url>
cd JamSession
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), and stop the server with `Ctrl+C`.

## Supabase environments

The normal interactive development app currently targets the actual hosted Supabase project through the uncommitted `.env.local`. This is intentional so real Google OAuth, invitations, PostgREST, and Storage behavior use the shared hosted environment. `npm run dev` always follows `NEXT_PUBLIC_SUPABASE_URL`; starting local Supabase does not redirect the app to it.

Before debugging missing rows, RLS, Auth, RPCs, or Storage, check the host configured by `NEXT_PUBLIC_SUPABASE_URL` without exposing any keys. Use the logs and schema for that environment. Local containers and hosted Supabase are independent databases, so local logs cannot explain a request sent to the hosted URL, and locally applied migrations do not automatically update hosted Supabase.

Do not overwrite the existing hosted `.env.local` or apply migrations/repairs to hosted Supabase unless the task explicitly calls for that change. The local stack is the safe authority for clean migration resets, pgTAP/RLS tests, generated types, deterministic fixtures, and browser flows that explicitly opt into local Auth or Storage.

### Local Supabase validation stack

Start Docker Desktop, then launch local Postgres:

```powershell
npm run supabase:start
npm run supabase:status
```

The first start downloads the database image and can take a while. This command intentionally starts only Postgres for migration, pgTAP, and type-generation work. Use `npm run supabase:start:auth` for authentication flows or `npm run supabase:start:storage` for upload/playback flows; each starts only the services that feature needs.

Copy the example environment file without overwriting an existing local file:

```powershell
Copy-Item .env.example .env.local
```

On macOS/Linux:

```bash
cp .env.example .env.local
```

Only when intentionally switching an app session to the local backend, use `npm run supabase:status` to obtain the local API URL and Publishable key, then place those values and one canonical `SITE_URL` in a temporary local environment configuration. Preserve the hosted `.env.local` values so they can be restored exactly. Use either `http://localhost:3000` everywhere or `http://127.0.0.1:3000` everywhere; mixing them breaks OAuth PKCE cookies. The application never needs the Secret/service-role key in browser configuration. Never commit `.env`, `.env.local`, credentials, or service-role keys.

Reset migrations and deterministic seed data, run the database checks, then stop the stack when finished:

```powershell
npm run db:reset
npm run db:check
npm run supabase:stop
```

`npm run db:reset` permanently deletes all local database content before reapplying migrations and seed data. Confirm the CLI is targeting the intended local project before running destructive commands. `npm run db:types` regenerates the committed TypeScript definitions atomically from the running local database; `npm run db:types:check` detects drift without modifying tracked files.

The configured hosted Supabase project is the normal interactive-development backend. Invitations and hosted migrations must be applied to the same project named by `NEXT_PUBLIC_SUPABASE_URL`; inserting into or migrating local Postgres does not change the hosted application.

## Common commands

Run commands from the repository root:

| Command                          | Purpose                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `npm ci`                         | Reproduce dependencies from the lockfile                        |
| `npm run dev`                    | Start the local development server                              |
| `npm run check`                  | Run formatting, lint, types, unit tests, and a production build |
| `npm run format`                 | Format supported files                                          |
| `npm run format:check`           | Check formatting without changing files                         |
| `npm run lint`                   | Run ESLint with zero warnings allowed                           |
| `npm run typecheck`              | Run strict TypeScript checking                                  |
| `npm test`                       | Run unit and component tests once                               |
| `npm run test:watch`             | Run unit tests while editing                                    |
| `npm run test:coverage`          | Generate a local coverage report                                |
| `npm run build`                  | Create a production Next.js build                               |
| `npm run start`                  | Serve an existing production build                              |
| `npm run test:e2e`               | Run Playwright browser tests                                    |
| `npm run test:e2e:local`         | Configure and run the full local browser suite                  |
| `npm run test:e2e:identity`      | Run the local onboarding/upload/publish journey                 |
| `npm run test:e2e:studio`        | Run the fast fixture-backed studio startup smoke test           |
| `npm run test:e2e:upload`        | Run the browser WAV-to-FLAC upload journey                      |
| `npm run supabase:start`         | Start local Supabase Postgres only                              |
| `npm run supabase:start:auth`    | Start the reduced local Auth stack                              |
| `npm run supabase:start:storage` | Start the reduced local Storage/upload stack                    |
| `npm run supabase:stop`          | Stop local Supabase while preserving its database               |
| `npm run supabase:status`        | Show local database state                                       |
| `npm run db:reset`               | Recreate the local database and apply seed data                 |
| `npm run db:test`                | Run pgTAP tests against local Postgres                          |
| `npm run db:check`               | Lint/test the database and check generated-type drift           |
| `npm run db:types`               | Atomically regenerate committed database types                  |
| `npm run auth:e2e:setup`         | Prepare the gated local/CI test Auth actor                      |
| `npm run assets:verify`          | Lease-aware fallback verification of a processing source asset  |
| `npm run assets:cleanup`         | Dry-run reference-aware asset cleanup                           |
| `npm run avatars:process`        | Recover pending or expired profile-image processing jobs        |
| `npm run avatars:cleanup`        | Dry-run cleanup of expired private avatar uploads               |

Before the first browser-test run, download Playwright's Chromium build once:

```powershell
npx playwright install chromium
```

That browser download is only needed for E2E tests, not normal development.

For reliable local browser testing, start the reduced Storage stack and reset its database once, then use a targeted runner:

```powershell
npm run supabase:start:storage
npm run db:reset
npm run test:e2e:studio
```

Use `npm run test:e2e:identity` for onboarding, upload, verification, and first publish, `npm run test:e2e:upload` for browser lossless conversion, or `npm run test:e2e:local` for the complete browser suite. These local commands read the local Supabase values, prepare the test actor, force one Playwright worker, and run Next.js from the ignored `.next-e2e` directory so an ordinary development server does not share its lock or artifacts. The runner owns and cleans up that server process tree. It refuses non-local Supabase targets and fails during preflight when Storage or port 3100 is unavailable. No copied environment variables or Edge Runtime process is required.

### Audio-delivery benchmark fixtures

OPT-01 adds deterministic large WAV generation and local browser benchmarks without committing media. OPT-02 extends the delivery harness with `--loader progressive` so shell timing and actor-scoped warm reuse are measured separately from full WAV playback readiness. OPT-03 adds an optional lossless WAV-to-FLAC worker with progress, cancellation/fallback and same-PCM transient peak generation; OPT-04 persists those small private peaks. The generated FLAC is the canonical immutable source and download, not a duplicate of the selected WAV. FLAC and MP3 selections pass through unchanged.

OPT-05 adds `scripts/generate-studio-flac-fixtures.mjs`, which uses the exact pinned production encoder/settings and rejects metadata or decoded-PCM drift, plus `--format wav|flac` delivery comparisons. Compression ratios are controlled synthetic-fixture evidence, not promises for recorded music. Generated media and raw results remain under ignored `local/`. See the [OPT-01 baseline](docs/technical-design/evidence/opt-01-audio-delivery-baseline.md), [OPT-02 progressive evidence](docs/technical-design/evidence/opt-02-progressive-studio.md), [OPT-03 lossless-upload evidence](docs/technical-design/evidence/opt-03-browser-lossless-upload.md), [OPT-04 persisted-peaks evidence](docs/technical-design/evidence/opt-04-persisted-waveform-peaks.md), and [OPT-05 rollout evidence](docs/technical-design/evidence/opt-05-audio-delivery-rollout.md). Start with:

```powershell
node scripts/generate-studio-audio-fixtures.mjs --profile controlled
node scripts/generate-studio-flac-fixtures.mjs --profile controlled
node scripts/benchmark-studio-audio.mjs --profile controlled --format flac --loader progressive --phase both --repetitions 5
```

These commands use loopback only and do not read or mutate hosted Supabase.

## Repository map

```text
src/app/           Next.js routes, layouts, styles, and route-owned UI
src/components/    Reusable layout and UI primitives used by current routes
src/features/      Feature-owned auth, profile, project, asset, revision, workspace, export, studio, and planned MIDI code
src/lib/env/       Runtime configuration validation
src/lib/supabase/  Generated database types and user-scoped client factories
src/test/          Shared unit-test setup
supabase/          Local stack configuration, seed entry point, and pgTAP tests
scripts/           Cross-platform repository automation
tests/e2e/         Playwright browser journeys
public/            Static files served by Next.js
docs/              Product requirements, roadmap, brand guidance, technical design, and decisions
local/             Untracked personal implementation plans; never committed
```

The `supabase/` directory contains forward-only migrations, local configuration, deterministic seeds, and pgTAP authorization/transaction tests. Typed repositories live in `src/server/repositories`; multi-row lifecycle authority remains in database commands.

## Core architecture vocabulary

| Concept      | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| Project      | Long-lived song identity, metadata, visibility, and current revision     |
| Revision     | Immutable published snapshot of an arrangement and its referenced assets |
| Workspace    | Mutable private draft based on a revision                                |
| Contribution | Review workflow containing an immutable proposed version                 |
| Fork         | New project that points back to an exact source project and revision     |
| Asset        | Immutable audio, editor snapshot, preview, waveform, or image object     |

The backend forms a Git-like revision graph using Postgres relationships and immutable Storage assets rather than literal Git repositories. Projects point to immutable revisions; normalized tracks and append-only asset references form the currently implemented graph. See the [system architecture](docs/technical-design/01-system-architecture.md) and [data model](docs/technical-design/02-data-model.md) for details.

## Troubleshooting

### `npm ci` reports an unsupported Node version

Run `node --version`. Install or switch to Node 24, then open a new terminal. Do not delete the `engines` rule to bypass the check.

### `npm ci` says the package file and lockfile disagree

Make sure you did not manually edit `package.json`. Restore unintended changes and retry. Contributors should use `npm ci`; dependency updates are deliberate changes performed with `npm install`.

### Port 3000 is already in use

Another development server may still be running. Stop it with `Ctrl+C`, or start Jam Session on another port:

```powershell
npm run dev -- --port 3001
```

Then open `http://localhost:3001`.

### Reinstall dependencies cleanly

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
npm ci
```

On macOS/Linux:

```bash
rm -rf node_modules
npm ci
```

Do not delete `package-lock.json`; it is the reproducibility contract.

### Supabase cannot connect to Docker

Confirm Docker Desktop is running and `docker version` shows both Client and Server sections. Start the engine before retrying `npm run supabase:start`. If a previous stack is stale, run `npm run supabase:stop` and start it again; do not delete checked-in configuration or migrations.

### A local Supabase port is already in use

Stop the other local Supabase project or container using the reported port. The checked-in default ports are part of the documented environment contract; avoid changing them only for a one-machine conflict.

### Generated database types are stale

Start Supabase, run `npm run db:reset`, then run `npm run db:types`. Commit the resulting `src/lib/supabase/database.types.ts` change with the migration that caused it.

### Authentication development

Use `npm run supabase:start:auth` when explicitly exercising Auth, PostgREST, and browser identity flows against local Supabase; database-only checks continue to use the lighter `npm run supabase:start`. Normal interactive development remains pointed at hosted Supabase. If deliberately switching to local, configure a temporary environment from `.env.example` with the local API URL, publishable key, and `SITE_URL`, then restore the hosted `.env.local` afterward.

Product sign-in is Google-only. Google Cloud, hosted Supabase, exact callback URLs, invitation provisioning, and the production smoke checklist are documented in [docs/setup/google-auth.md](docs/setup/google-auth.md). Local/CI browser automation can prepare the seeded `.test` actor with `npm run auth:e2e:setup`; it requires an ephemeral `TEST_AUTH_PASSWORD`, and the test route additionally requires `ENABLE_TEST_AUTH=true`.

If OAuth reports a callback mismatch, compare the canonical `SITE_URL`, Supabase redirect allowlist, and Google/Supabase callback URI exactly. Do not alternate between `localhost` and `127.0.0.1`. If an invited account is rejected, confirm the normalized invitation is active in the same hosted/local database the app uses and that the Before User Created hook was enabled after migration. If OAuth succeeds but onboarding reports `viewer_profile_PT500`, verify the `on_auth_user_created` trigger and backfill a profile for any Auth user created before that trigger. Clear stale cookies after changing origins or resetting Auth.

The authenticated Studio start center is available at `/studio` without loading editor/audio code. A selected project opens canonically at `/studio/{projectId}`; `/projects/{projectId}/studio` redirects there for compatibility. The selected route independently authorizes the viewer, lazy-loads Waveform Playlist only after project selection, renders saved lanes and safe controls immediately, then signs and decodes exact private source assets progressively. Track gutters report queued/loading/decoding/ready/failed state; synchronized play remains disabled until every audible track is ready, and one failed track can retry without discarding ready buffers. A bounded actor-scoped in-memory registry reuses immutable decoded sources within the current browser session and clears on actor change/sign-out; it never persists audio or uses a signed URL as a cache identity. Members retain session-only mixer changes. Owners can create or reopen a private workspace, autosave the promoted editing subset while audio loads, publish a later immutable revision, download original stems directly from Storage, and render a bounded 16-bit WAV mix after all tracks are ready. The former `/__spikes__/studio` route and `ENABLE_STUDIO_SPIKE` flag no longer exist.

STUDIO-01 implemented `/studio` as the authenticated start center and `/studio/{projectId}` as the independently authorized selected session, with the nested URL retained only as a compatibility redirect. STUDIO-02 adds the bounded project browser, shared in-shell/project-page creation contract, and generation-aware save/recovery/disposal coordinator for serial switching. STUDIO-03 replaces the form-like MIDI surface with a shared audio/MIDI ruler, lanes, channel strips, selection, and inspector. STUDIO-04–STUDIO-05 add arrangement mutation and integrate the existing piano roll/recorder into Studio; STUDIO-06 owns parity and final source-admission lock enablement. See the [roadmap](docs/ROADMAP.md) and [studio-forward plan](docs/studio-forward-refactor-plan.md).

While the repository is pinned to Next.js 16.2.10, the studio route intentionally has no route-level `loading.tsx`. That boundary triggered upstream Firefox development issue `vercel/next.js#94128`, where a streaming navigation was mistaken for a cache restore and the document hard-refreshed repeatedly. Do not restore a `loading.tsx` at `projects/[projectId]` or its studio segment until a deliberate Next.js upgrade includes the fix and a focused Firefox studio-navigation check passes.

### Supabase configuration is missing

The public shell can render without visiting an authenticated feature, but authentication, profiles, projects, uploads, revisions, and studio playback require valid Supabase environment variables. Missing values produce an actionable validation error. Restart the development server after changing `.env.local`.

### Docker Desktop and WSL disagree

On Windows, confirm Docker Desktop is using Linux containers and that WSL integration is enabled for the distribution where you run commands. Run repository commands consistently from either PowerShell or the same integrated WSL distribution.

### Containers are stale after a CLI upgrade

Preserve any needed local schema/data first, then follow the Supabase CLI upgrade guidance for stopping and recreating local containers. Normal `npm run supabase:stop` preserves local database state.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Coding agents must also follow [AGENTS.md](AGENTS.md). Product or architectural changes should cite the relevant PRD, technical-design section, or ADR.

## License

No license has yet been selected for Jam Session's own source code; all rights are reserved unless explicitly stated otherwise. Third-party dependencies retain their own licenses and notices. Do not copy third-party demo audio or other assets without confirming redistribution rights.
