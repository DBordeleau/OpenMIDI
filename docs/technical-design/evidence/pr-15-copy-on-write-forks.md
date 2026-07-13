# PR 15 copy-on-write fork evidence

## Implemented boundary

- `projects.source_project_id` and `source_revision_id` record an immutable, exact direct parent.
- `fork_project(...)` authorizes the actor and source under lock, enforces derivative-license permission, and creates the target project, owner membership, first immutable revision, copied taxonomies, asset references, projected usage, and one activity event atomically.
- Forks reuse existing source assets and preserve ordered track-credit snapshots while recording the forking actor as the new revision publisher.
- Forks begin private with contributions closed and create their editable workspace lazily.
- Project pages expose an RLS-filtered parent link with an unavailable fallback and at most 20 directly accessible children.

## Automated evidence

- Clean local migration reset: `npm run db:reset`.
- Database lint, all 382 pgTAP assertions, and generated-type drift: `npm run db:check`.
- The PR 15 pgTAP file contributes 35 assertions covering anonymous, unrelated, suspended, owner/member, stale-license, non-derivative, idempotent, conflicting-request, immutable-lineage, no-copy, lazy-workspace, credit/provenance, and source-access-loss paths.
- Fork schema unit tests cover validated input and Unicode-safe default titles.
- `npm run check` passes formatting, ESLint, TypeScript, all 93 Vitest assertions, and the Next.js production build.
- `tests/e2e/forks.spec.ts` exercises confirmation, creation, redirect/status, parent/child navigation, private defaults, no asset-row increase, and lazy workspace creation. The local run exposed and fixed two idempotent-fixture issues plus an auth-redirect race; the final synchronization-only adjustment was not rerun after reaching the plan's browser troubleshooting ceiling.
- After verification, the pre-existing hosted-config development server was restored and returned HTTP 200 with rendered Jam Session content. The optional `agent-browser` visual CLI was unavailable on PATH.

## Operational notes

- Deploy the forward-only fork migration before application code that selects lineage columns or invokes `fork_project(...)`.
- Regenerated `src/lib/supabase/database.types.ts` must deploy with the migration and application code.
- This evidence is local migration/RLS proof only; it does not assert that the hosted Supabase project has received the migration.
