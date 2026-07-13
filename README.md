# Jam Session

Jam Session is an asynchronous music-collaboration platform inspired by Git and open-source development. Musicians will be able to share stems, propose contributions, and fork songs into new creative directions while preserving history and attribution.

> **Current status:** early MVP foundation. The repository contains a responsive public product shell, a small semantic UI foundation, local Supabase Postgres development and typed client infrastructure, and quality tooling. Authentication, projects, uploads, contributions, and OpenDAW are not implemented yet.

## Planned MVP

- Create music projects and upload stems.
- Arrange and mix compatible audio in a browser workspace.
- Submit a contribution for the project owner to review.
- Accept or reject contributions without rewriting project history.
- Fork a project while preserving its source and contributor credits.
- Discover public projects by musical metadata.

The [product requirements](docs/PRD.md) describe the intended experience. The [technical-design index](docs/technical-design/README.md) explains how it will be built.

## Technology

- [Next.js](https://nextjs.org/) App Router and TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Motion for React](https://motion.dev/docs/react) (formerly Framer Motion) for purposeful interaction animation
- [Supabase](https://supabase.com/) for Postgres, Auth, and Storage once backend work begins
- [OpenDAW](https://github.com/andremichelle/openDAW) behind a client-only adapter once the studio spike begins
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

## Local Supabase setup

Start Docker Desktop, then launch local Postgres:

```powershell
npm run supabase:start
npm run supabase:status
```

The first start downloads the database image and can take a while. PR 01 deliberately starts only Postgres; Auth, Storage, Realtime, Studio, Mailpit, Edge Functions, analytics, and image services are deferred until a feature uses them.

The typed SSR client factories are infrastructure for later work and are not imported by the current application. When Auth integration begins, copy the example environment file without overwriting an existing local file:

```powershell
Copy-Item .env.example .env.local
```

On macOS/Linux:

```bash
cp .env.example .env.local
```

The later Auth setup will document how to obtain the local API URL and Publishable key. The application never needs the local Secret key in browser configuration. Never commit `.env`, `.env.local`, credentials, or service-role keys.

Reset migrations and deterministic seed data, run the database checks, then stop the stack when finished:

```powershell
npm run db:reset
npm run db:check
npm run supabase:stop
```

`npm run db:reset` permanently deletes all local database content before reapplying migrations and seed data. It never targets a remote database in this repository's current unlinked configuration. The public schema is intentionally empty at this stage. `npm run db:types` regenerates the committed TypeScript definitions atomically from the running local database; `npm run db:types:check` detects drift without modifying tracked files.

No remote Supabase project is required. The application remains at `http://127.0.0.1:3000`; `npm run supabase:status` is authoritative for the local database state.

## Common commands

Run commands from the repository root:

| Command                   | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `npm ci`                  | Reproduce dependencies from the lockfile                        |
| `npm run dev`             | Start the local development server                              |
| `npm run check`           | Run formatting, lint, types, unit tests, and a production build |
| `npm run format`          | Format supported files                                          |
| `npm run format:check`    | Check formatting without changing files                         |
| `npm run lint`            | Run ESLint with zero warnings allowed                           |
| `npm run typecheck`       | Run strict TypeScript checking                                  |
| `npm test`                | Run unit and component tests once                               |
| `npm run test:watch`      | Run unit tests while editing                                    |
| `npm run test:coverage`   | Generate a local coverage report                                |
| `npm run build`           | Create a production Next.js build                               |
| `npm run start`           | Serve an existing production build                              |
| `npm run test:e2e`        | Run Playwright browser tests                                    |
| `npm run supabase:start`  | Start local Supabase Postgres only                              |
| `npm run supabase:stop`   | Stop local Supabase while preserving its database               |
| `npm run supabase:status` | Show local database state                                       |
| `npm run db:reset`        | Recreate the local database and apply seed data                 |
| `npm run db:test`         | Run pgTAP tests against local Postgres                          |
| `npm run db:check`        | Lint/test the database and check generated-type drift           |
| `npm run db:types`        | Atomically regenerate committed database types                  |

Before the first browser-test run, download Playwright's Chromium build once:

```powershell
npx playwright install chromium
```

That browser download is only needed for E2E tests, not normal development.

## Repository map

```text
src/app/           Next.js routes, layouts, styles, and route-owned UI
src/components/    Reusable layout and UI primitives used by current routes
src/features/      Feature-owned code; the future studio adapter boundary lives here
src/lib/env/       Runtime configuration validation
src/lib/supabase/  Generated database types and user-scoped client factories
src/test/          Shared unit-test setup
supabase/          Local stack configuration, seed entry point, and pgTAP tests
scripts/           Cross-platform repository automation
tests/e2e/         Playwright browser journeys
public/            Static files served by Next.js
docs/              Product requirements, technical design, and decisions
local/             Untracked personal implementation plans; never committed
```

The `supabase/` directory contains local configuration, deterministic seed structure, and database tests. Migrations, server repositories, and reusable components will be introduced with the first real behavior that needs them.

## Core architecture vocabulary

| Concept      | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| Project      | Long-lived song identity, metadata, visibility, and current revision     |
| Revision     | Immutable published snapshot of an arrangement and its referenced assets |
| Workspace    | Mutable private draft based on a revision                                |
| Contribution | Review workflow containing an immutable proposed version                 |
| Fork         | New project that points back to an exact source project and revision     |
| Asset        | Immutable audio, editor snapshot, preview, waveform, or image object     |

The backend will form a Git-like revision graph using Postgres relationships and immutable Storage assets rather than literal Git repositories. See the [system architecture](docs/technical-design/01-system-architecture.md) and [data model](docs/technical-design/02-data-model.md) for details.

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

### Supabase configuration is missing

The static application shell works without Supabase environment variables. When a later feature first requests a Supabase client, missing values produce an error naming the required variable. That feature's setup will provide the local API URL and Publishable key; restart the development server after adding them.

### Docker Desktop and WSL disagree

On Windows, confirm Docker Desktop is using Linux containers and that WSL integration is enabled for the distribution where you run commands. Run repository commands consistently from either PowerShell or the same integrated WSL distribution.

### Containers are stale after a CLI upgrade

Preserve any needed local schema/data first, then follow the Supabase CLI upgrade guidance for stopping and recreating local containers. Normal `npm run supabase:stop` preserves local database state.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Coding agents must also follow [AGENTS.md](AGENTS.md). Product or architectural changes should cite the relevant PRD, technical-design section, or ADR.

## License

No project license has been selected yet. All rights are reserved unless explicitly stated otherwise. Do not redistribute OpenDAW-derived code or assets. Licensing will be revisited before external alpha or public distribution.
