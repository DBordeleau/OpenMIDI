# Jam Session

Jam Session is a public MIDI creation, remix, reuse, and constraint-challenge platform for bedroom producers, casual musicians, and learners. Musicians build arrangements from reusable MIDI patterns, preserve immutable revision history, propose contributions with durable attribution, and fork projects with navigable lineage.

> **Current status:** PIVOT-01 through PIVOT-10 are implemented on the `midi-only-pivot` integration branch. The application, clean schema baseline, hosted Supabase project, deterministic seed, and default test path are MIDI-only; avatar originals and derivatives are the only Storage media. Vercel deployment is intentionally deferred. PR 19/20 and the OPT/MIDI/STUDIO sequencing are historical delivery evidence, not current work.

## Target MVP scope

- Create, record, edit, arrange, and mix reusable MIDI patterns in the browser Studio.
- Publish immutable arrangement versions with human-readable semantic MIDI diffs.
- Submit a contribution for the project owner to review.
- Accept or reject contributions without rewriting project history.
- Fork and reuse public MIDI while preserving creator lineage and CC BY 4.0 attribution.
- Discover public projects and prepare the domain foundation for constraint challenges and a reusable MIDI library.

The [product requirements](docs/PRD.md) describe the intended experience, the tracked [MVP roadmap](docs/ROADMAP.md) shows what is complete and what comes next, the [MIDI-only pivot contract](docs/technical-design/midi-only-pivot-contract.md) freezes the target vocabulary and parallel ownership, the [technical-design index](docs/technical-design/README.md) explains how it is built, and the [brand and visual-design guide](docs/design/brand.md) defines the product voice and presentation for user-facing surfaces. The [studio-forward plan](docs/studio-forward-refactor-plan.md) remains a historical record of the refactor that produced the current Studio.

## Technology

- [Next.js](https://nextjs.org/) App Router and TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Motion for React](https://motion.dev/docs/react) (formerly Framer Motion) for purposeful interaction animation
- [Supabase](https://supabase.com/) for Postgres, invite-only Google Auth, and private avatar Storage
- [Tone.js](https://tonejs.github.io/) behind a client-only MIDI runtime and versioned bundled synthesis presets
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

`npm run dev` always follows the uncommitted `NEXT_PUBLIC_SUPABASE_URL`; starting local Supabase does not redirect the app automatically. The retained hosted project and clean local stack both implement the MIDI-only baseline, but remain independent environments.

Before debugging missing rows, RLS, Auth, RPCs, or Storage, check the host configured by `NEXT_PUBLIC_SUPABASE_URL` without exposing any keys. Use the logs and schema for that environment. Local containers and hosted Supabase are independent databases, so local logs cannot explain a request sent to the hosted URL, and locally applied migrations do not automatically update hosted Supabase.

Do not overwrite an existing `.env.local` or apply migrations/repairs to hosted Supabase unless the task explicitly authorizes that change. The local stack remains the authority for clean migration resets, pgTAP/RLS tests, generated types, deterministic fixtures, and local browser flows. See the [PIVOT-10 hosted evidence](docs/technical-design/evidence/pivot-10-hosted-rebaseline.md) for the completed four-migration hosted baseline. Later repository migrations, including administrator invitation reconciliation, require a separate target check and explicit hosted application; merging code never applies them automatically.

### Local Supabase validation stack

Start Docker Desktop, then launch local Postgres:

```powershell
npm run supabase:start
npm run supabase:status
```

The first start downloads the database image and can take a while. This command intentionally starts only Postgres for migration, pgTAP, and type-generation work. Use `npm run supabase:start:auth` for authentication and the default MIDI browser suite. Use `npm run supabase:start:storage` only for avatar-specific flows.

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

Local invitations and migrations do not change the hosted project. Hosted changes always require explicit operational authority even though PIVOT-10 is complete.

## Common commands

The table reflects the executable MIDI-only repository.

Run commands from the repository root:

| Command                          | Purpose                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `npm ci`                         | Reproduce dependencies from the lockfile                        |
| `npm run dev`                    | Start the local development server                              |
| `npm run check`                  | Run formatting, lint, types, unit tests, and a production build |
| `npm run check:midi-only`        | Enforce the zero-legacy-audio repository contract               |
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
| `npm run test:e2e:local`         | Run the required local MIDI browser suite                       |
| `npm run test:e2e:identity`      | Run local onboarding and first-project creation                 |
| `npm run test:e2e:studio`        | Run the fast fixture-backed studio startup smoke test           |
| `npm run supabase:start`         | Start local Supabase Postgres only                              |
| `npm run supabase:start:auth`    | Start the reduced local Auth stack                              |
| `npm run supabase:start:storage` | Start the reduced avatar Storage stack                          |
| `npm run supabase:stop`          | Stop local Supabase while preserving its database               |
| `npm run supabase:status`        | Show local database state                                       |
| `npm run db:reset`               | Recreate the local database and apply seed data                 |
| `npm run db:test`                | Run pgTAP tests against local Postgres                          |
| `npm run db:check`               | Lint/test the database and check generated-type drift           |
| `npm run db:types`               | Atomically regenerate committed database types                  |
| `npm run auth:e2e:setup`         | Prepare the gated local/CI test Auth actor                      |
| `npm run avatars:process`        | Recover pending or expired profile-image processing jobs        |
| `npm run avatars:cleanup`        | Dry-run cleanup of expired private avatar uploads               |
| `npm run retention:preview`      | Preview bounded reference/hold-aware retention candidates       |
| `npm run retention:execute`      | Execute bounded leased cleanup through the Storage API          |

Before the first browser-test run, download Playwright's Chromium build once:

```powershell
npx playwright install chromium
```

That browser download is only needed for E2E tests, not normal development.

For reliable local browser testing, start the reduced Auth stack and reset its database once:

```powershell
npm run supabase:start:auth
npm run db:reset
npm run test:e2e:local
```

The default local suite covers Auth/onboarding, MIDI Studio create/save/reload/publish/preview, contribution acceptance, and fork lineage. Targeted runners accept an explicit spec path. The runner reads local Supabase values, prepares the gated actor, forces one Playwright worker, and owns an isolated `.next-e2e` server process tree. It refuses non-local targets and does not require Storage or Edge Runtime. Historical audio optimization evidence remains under `docs/technical-design/evidence/` for archaeology only.

## Repository map

```text
src/app/           Next.js routes, layouts, styles, and route-owned UI
src/components/    Reusable layout and UI primitives used by current routes
src/features/      Feature-owned auth, profile, project, MIDI, revision, workspace, export, and Studio code
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

| Concept      | Meaning                                                              |
| ------------ | -------------------------------------------------------------------- |
| Project      | Long-lived song identity, metadata, visibility, and current revision |
| Revision     | Immutable published wrapper around one exact arrangement version     |
| Workspace    | Mutable private draft based on a revision                            |
| Contribution | Review workflow containing an immutable proposed version             |
| Fork         | New project that points back to an exact source project and revision |
| Asset        | Private avatar original managed separately from the musical domain   |

The backend forms a Git-like revision graph in Postgres. Projects point to immutable revisions and arrangement versions; clips point to exact immutable MIDI pattern versions with durable creator lineage. Storage is used only for avatars. See the [system architecture](docs/technical-design/01-system-architecture.md) and [data model](docs/technical-design/02-data-model.md) for details.

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

Use `npm run supabase:start:auth` when explicitly exercising Auth, PostgREST, and browser identity flows against local Supabase; database-only checks continue to use the lighter `npm run supabase:start`. `npm run dev` always follows the values in the active environment. Use process-scoped local values for deterministic local flows; the retained hosted project is separately verified against the same MIDI-only baseline.

Product sign-in is Google-only. Google Cloud, hosted Supabase, exact callback URLs, invitation provisioning, and the production smoke checklist are documented in [docs/setup/google-auth.md](docs/setup/google-auth.md). Local/CI browser automation can prepare the seeded `.test` actor with `npm run auth:e2e:setup`; it requires an ephemeral `TEST_AUTH_PASSWORD`, and the test route additionally requires `ENABLE_TEST_AUTH=true`.

If OAuth reports a callback mismatch, compare the canonical `SITE_URL`, Supabase redirect allowlist, and Google/Supabase callback URI exactly. Do not alternate between `localhost` and `127.0.0.1`. If an invited account is rejected, confirm the normalized invitation is active in the same hosted/local database the app uses and that the Before User Created hook was enabled after migration. If OAuth succeeds but onboarding reports `viewer_profile_PT500`, verify the `on_auth_user_created` trigger and backfill a profile for any Auth user created before that trigger. Clear stale cookies after changing origins or resetting Auth.

The authenticated `/studio` start state renders a useful blank workstation—menu bar, transport, ruler, empty lanes, inspector, and status—without creating an implicit project or loading the browser-only MIDI runtime. File reuses the authorized New/Open flows and exposes lifecycle-aware Save/Close plus selected-session export actions. A selected project opens canonically at `/studio/{projectId}`; `/projects/{projectId}/studio` redirects there for compatibility. The selected route independently authorizes the viewer, lazy-loads the manifest-v3 MIDI surface, and resolves exact immutable pattern versions into arranged tracks and clips. Playback is synthesized locally from pinned bundled presets. Owners can create or reopen a private workspace, edit notes and arrangement state with optimistic autosave, publish an immutable revision, export Standard MIDI, and render a synthesized WAV entirely in the browser. Musical project data never uses Storage.

The historical STUDIO-01 through STUDIO-06 and UX slices established the shell, arranger, piano roll, and interaction model that the MIDI-only pivot retained and converted to manifest v3. Their [evidence](docs/technical-design/evidence/studio-06-parity-hardening.md) and [studio-forward plan](docs/studio-forward-refactor-plan.md) remain implementation history; the [roadmap](docs/ROADMAP.md) and current technical design are the authority for present behavior and next work.

While the repository is pinned to Next.js 16.2.10, the studio route intentionally has no route-level `loading.tsx`. That boundary triggered upstream Firefox development issue `vercel/next.js#94128`, where a streaming navigation was mistaken for a cache restore and the document hard-refreshed repeatedly. Do not restore a `loading.tsx` at `projects/[projectId]` or its studio segment until a deliberate Next.js upgrade includes the fix and a focused Firefox studio-navigation check passes.

### Supabase configuration is missing

The public shell can render without visiting an authenticated feature, but authentication, profiles, projects, revisions, and Studio persistence require valid Supabase environment variables. Missing values produce an actionable validation error. Restart the development server after changing `.env.local`.

### Docker Desktop and WSL disagree

On Windows, confirm Docker Desktop is using Linux containers and that WSL integration is enabled for the distribution where you run commands. Run repository commands consistently from either PowerShell or the same integrated WSL distribution.

### Containers are stale after a CLI upgrade

Preserve any needed local schema/data first, then follow the Supabase CLI upgrade guidance for stopping and recreating local containers. Normal `npm run supabase:stop` preserves local database state.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Coding agents must also follow [AGENTS.md](AGENTS.md). Product or architectural changes should cite the relevant PRD, technical-design section, or ADR.

## License

No license has yet been selected for Jam Session's own source code; all rights are reserved unless explicitly stated otherwise. Third-party dependencies retain their own licenses and notices. Do not copy third-party demo audio or other assets without confirming redistribution rights.
