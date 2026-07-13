# Contributing to Jam Session

Thanks for helping build Jam Session. The project is early, so focused changes and explicit reasoning are especially valuable.

## Before you begin

1. Follow the setup steps in [README.md](README.md).
2. Read the relevant product and technical context:
   - [Product requirements](docs/PRD.md)
   - [Technical-design index](docs/technical-design/README.md)
   - [Architecture decisions](docs/technical-design/decisions/README.md)
3. Coding agents must follow [AGENTS.md](AGENTS.md).

Discuss changes that alter product scope, the data model, authorization, persisted formats, OpenDAW integration, or established architectural decisions before investing in a large implementation.

## Making a change

- Start from an up-to-date branch. Names such as `feature/short-description` and `fix/short-description` are recommended until the repository adopts enforced conventions.
- Keep commits and pull requests focused on one outcome.
- Explain why the change is needed, not only what files changed.
- Include screenshots or a short recording for visible UI changes.
- Add tests at the layer that owns the behavior.
- Do not reformat unrelated files or mix opportunistic refactors into feature work.
- Preserve immutable history, RLS, private storage, and OpenDAW boundaries described in the technical design.

## Validate your work

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

If routes or browser-visible flows changed, also install Chromium once and run E2E tests:

```powershell
npx playwright install chromium
npm run test:e2e
```

Report any check you could not run and why. Never claim a check passed without running it.

For visible UI changes, also inspect the affected pages at 320, 768, 1280, and 1536 CSS pixels. Verify keyboard order, visible focus, reduced-motion behavior, readable zoom, and the absence of horizontal overflow. Keep public pages server-first; add a Client Component only around behavior that requires browser APIs or interaction.

## Tests

- Put deterministic domain and component tests next to their source as `*.test.ts` or `*.test.tsx`.
- Put complete browser journeys in `tests/e2e`.
- Test public behavior and accessibility rather than animation timing or private implementation details.
- Future database authorization behavior must be tested against local Supabase, not mocked RLS.
- OpenDAW version or manifest changes will require persisted round-trip fixtures.

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
