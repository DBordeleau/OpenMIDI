# PERF-02 authenticated content-link request fanout

Date: 2026-07-19

Outcome: Authenticated dashboard destinations and repeated project-index project/Studio links start cold while deliberate pointer or keyboard intent restores normal Next.js prefetch

## Causal boundary

The post-PERF-01 controlled production journey recorded 141 Edge Requests and 82 Function Invocations from sign in through opening one project and loading Studio, against provisional targets of 100 and 25. An untouched ready Studio then produced zero OpenMIDI requests for 60 seconds.

Sanitized production logs showed unsolicited requests for multiple visible `/projects/[projectId]` and `/studio/[projectId]` routes plus `/projects/new`, `/projects`, and dashboard challenge destinations. Exact project identifiers are intentionally omitted. The idle result and route clustering bound PERF-02 to the authenticated dashboard and `/projects` index; no public discovery, library, challenge, contribution, profile list, project-detail action, or Studio runtime is implicated.

## Implemented policy

- Every internal dashboard destination starts with viewport prefetch disabled. Review, feedback, administrator triage, owned-project collections/items, active workspaces/contributions, pending-contribution collections/items, empty states, and the featured-challenge card use the existing `IntentPrefetchLink` client island.
- The dashboard `New project` button remains an ordinary `ButtonLink` with explicit `prefetch={false}`.
- Each repeated project title, `Open project`, and conditionally visible `Open in studio` link on `/projects` uses `IntentPrefetchLink`.
- Project-index `New project`, `Next projects`, and `Create your first project` buttons pass explicit `prefetch={false}`.
- `ButtonLink` accepts only the narrow optional `prefetch?: false` override and preserves the framework default for every consumer that omits it.

The existing intent primitive still changes `prefetch={false}` to `prefetch={null}` after pointer enter, mouse enter, or keyboard focus. Routes, copy, styling, conditional visibility, accessible link semantics, touch/click navigation, authorization, and data freshness are unchanged. No timer, observer, analytics, dependency, cache, middleware, polling, or broad Link abstraction was added.

## Verification

Focused component/page coverage proves:

- `ButtonLink` forwards explicit `prefetch={false}` and preserves its existing default when omitted;
- populated and empty dashboard destinations start cold, retain their hrefs, and one repeated link warms after intent;
- each visible project card's repeated project and eligible Studio destinations start cold;
- Studio-link visibility remains conditional; and
- project-index page and empty-state buttons disable viewport prefetch.

Pre-merge verification:

- `npm test -- src/components/ui/button.test.tsx src/app/dashboard/page.test.tsx src/app/projects/page.test.tsx`: passed (3 files, 8 tests).
- `npm run check`: passed, including formatting, lint, strict types, 117 test files/381 tests, the MIDI-only and identity static contracts, and the production build.
- `npm run test:e2e:identity`: unavailable after the documented two environment attempts. The first preflight found the local Supabase stack stopped; the single reduced-Auth startup correction found Docker Desktop's Linux engine unavailable. No browser test or database reset ran, hosted Supabase was not contacted, and no assertion was weakened.
- `git diff --check`: passed.

No local database, Storage, migration, seed, or hosted Supabase validation is required because PERF-02 changes no schema, RLS, Auth, Storage, or data behavior.

## Production measurement status

The pre-merge state has no PERF-02 production result because implementation work is not authorized to deploy production manually. After the automatic merged deployment becomes ready, repeat one fresh Incognito sign-in â†’ open one project â†’ load Studio journey without hovering or focusing unrelated links. Record the exact UTC window, deployment/commit, Edge Requests, Function Invocations, sanitized route categories, and whether any unchosen project or Studio route appeared.

The provisional targets remain at most 100 Edge Requests, at most 25 Function Invocations, zero unchosen project/Studio routes, and zero dashboard destinations warmed merely because they rendered. The PERF-01 zero-request Studio idle result remains valid because no Studio file changed; one post-merge confirmation is useful but not a local gate.

## Expected remaining requests

Expected traffic includes requested page/RSC responses, immutable framework assets, deliberate hover/focus warming, deliberate click/touch navigation, verified Auth claim or token activity, and authorized actions after an actual user mutation. Direct Supabase traffic and browser-local MIDI activity remain separate from Vercel Edge and Function totals.

## Rollback

Rollback is application-only: revert the dashboard/project-index Link policy and narrow `ButtonLink` prop, redeploy the previously verified application artifact, and repeat deliberate dashboard/project navigation smoke. Do not touch Supabase schema, migration history, Auth, Storage, seed state, or hosted data. A localized regression can fall back to `prefetch={false}` without restoring viewport prefetch.
