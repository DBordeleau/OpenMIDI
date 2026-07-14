# Contributing to Jam Session

Thanks for helping build Jam Session. The project is early, so focused changes and explicit reasoning are especially valuable.

## Before you begin

1. Follow the setup steps in [README.md](README.md).
2. Read the relevant product and technical context:
   - [Product requirements](docs/PRD.md)
   - [MVP roadmap and current status](docs/ROADMAP.md)
   - [Technical-design index](docs/technical-design/README.md)
   - [Architecture decisions](docs/technical-design/decisions/README.md)
   - [Brand and visual design](docs/design/brand.md) for any user-facing change
3. Coding agents must follow [AGENTS.md](AGENTS.md).

Discuss changes that alter product scope, the data model, authorization, persisted formats, browser-studio integration, or established architectural decisions before investing in a large implementation.

## Making a change

- Start from an up-to-date branch. Names such as `feature/short-description` and `fix/short-description` are recommended until the repository adopts enforced conventions.
- Keep commits and pull requests focused on one outcome.
- Explain why the change is needed, not only what files changed.
- Include screenshots or a short recording for visible UI changes, demonstrating consistency with the brand guide as well as the intended interaction.
- Add tests at the layer that owns the behavior.
- Do not reformat unrelated files or mix opportunistic refactors into feature work.
- Preserve immutable history, RLS, private storage, and browser-studio boundaries described in the technical design.

## Validate your work

Use focused checks while iterating. Run only the affected test file, type check, database test, or browser scenario that can disprove the current change. Once the implementation is stable, run each applicable broad completion gate once; do not repeatedly rerun successful suites after documentation or another change that cannot affect them.

Before requesting review, run:

```powershell
npm run check
```

For database or Supabase infrastructure changes, start the local stack and also run:

```powershell
npm run db:reset
npm run db:check
```

The reset command deletes local database content and reapplies committed migrations and seed data. See the README for Docker setup and type generation.

The normal interactive dev app uses the hosted Supabase project configured in `.env.local`; the local stack above is the migration/RLS/type-validation environment. Before investigating Supabase behavior, check the host in `NEXT_PUBLIC_SUPABASE_URL` without printing secrets and inspect the environment that actually received the request. Do not infer that the app uses local containers because they are running, and do not mutate hosted schema/data unless the task explicitly authorizes it.

If routes or browser-visible flows changed, also install Chromium once and run E2E tests:

```powershell
npx playwright install chromium
npm run supabase:start:storage
npm run db:reset
npm run test:e2e:studio
```

Choose the narrowest relevant runner during implementation: `npm run test:e2e:studio` for studio startup/save behavior, `npm run test:e2e:identity` for onboarding/upload/publish behavior, and `npm run test:e2e:local` for cross-feature or final browser validation. The runner configures local Supabase and the gated actor automatically; do not manually copy local keys into the shell. The raw `npm run test:e2e` command assumes its environment is already configured and is primarily for CI.

Report any check you could not run and why. Never claim a check passed without running it.

Environment-dependent checks have a two-attempt troubleshooting ceiling by default. If Docker, Auth/Storage setup, Chromium installation, a test actor, or a fixture remains unavailable after two focused attempts, stop and report the observed cause instead of consuming unbounded time or resources. Manual multi-browser, audible-audio, Preview, performance, and extended interruption matrices should be agreed explicitly when they materially increase cost.

For visible UI changes, also inspect the affected pages at 320, 768, 1280, and 1536 CSS pixels. Verify keyboard order, visible focus, reduced-motion behavior, readable zoom, and the absence of horizontal overflow. Keep public pages server-first; add a Client Component only around behavior that requires browser APIs or interaction.

## Tests

- Put deterministic domain and component tests next to their source as `*.test.ts` or `*.test.tsx`.
- Put complete browser journeys in `tests/e2e`.
- Test public behavior and accessibility rather than animation timing or private implementation details.
- Future database authorization behavior must be tested against local Supabase, not mocked RLS.
- Waveform Playlist/Tone.js version or manifest changes require persisted round-trip fixtures.

## Secrets and local files

Never commit:

- `.env` or `.env.local`
- API keys, OAuth secrets, cookies, or signed URLs
- Uploaded audio or private user data
- `node_modules`, builds, coverage, or test reports
- Anything under `local/`

Use `.env.example` to document variable names without real values.

## Documentation and migrations

Update documentation when commands, persisted behavior, architectural boundaries, or contributor setup change. Once Supabase is configured, schema changes must include forward-only migrations, generated types, and RLS integration tests in the same pull request.

GitHub issue and pull-request templates will be added after the repository workflow is established. Until then, make pull requests self-contained: outcome, rationale, verification, screenshots where applicable, known limitations, and deployment or migration notes.
