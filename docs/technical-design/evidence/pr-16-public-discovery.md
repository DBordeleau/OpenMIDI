# PR 16 — Public Project Discovery Evidence

Date: 2026-07-13

## Delivered behavior

PR 16 adds owner-controlled `private`/`public` transitions, a read-only safe public catalog, bounded canonical Explore filters, stable recent/trending keyset ordering, metadata-only public project pages, public profile project/accepted-contribution history, and public fork/contribution entry for eligible authenticated actors. Public visibility never grants source-audio access.

The database owns eligibility and cache safety. Transactional catalog refreshes advance `discovery_state.version`; application caches include that fresh version in their keys. Public-to-private removal therefore selects a new cache key even when a transition is invoked directly through the RPC.

Contribution participants retain a narrowly scoped project-context RPC after a project returns private. Source-asset authorization is shared by table and Storage policies and permits only the asset owner, a referenced project member, an active-workspace owner, an immutable contribution-version author, or the owner reviewing a non-draft submitted version.

## Verification

- Clean local migration reset: passed.
- Database lint, generated-type drift, and 20 pgTAP files: passed; 415 assertions total.
- PR 16 pgTAP file: passed; 33 assertions covering catalog isolation, search/filter behavior, transitions, public fork/contribution eligibility, participant continuity, source-audio denial/authority, suspended denial, and safe lineage.
- Formatting: passed.
- ESLint: passed after removing two unused-value warnings.
- TypeScript: passed.
- Vitest: the full run passed 96 existing assertions and exposed one new repeated-scalar parser defect; after correction the focused discovery file passed 3/3. The unchanged 96 assertions were not rerun under the repository's cost-bounded policy.
- Production build: passed on Next.js 16.2.10. `/explore` and `/projects/[projectId]` are dynamic server-rendered routes.
- Build artifact scan: no Waveform Playlist, Tone, audio-source, or stem-download string was found in the Explore/public-project page artifacts. Member stem downloads are loaded only after the member branch succeeds.
- `git diff --check`: passed.

The guarded Chromium discovery test was attempted twice against the reduced local Auth/API stack. Both attempts stopped during deterministic fixture creation before navigation: first on the project/current-revision insertion order, then on confirming asset credits before inserting their rows. Both fixture defects are corrected in the committed test, but the two-attempt environment cap was reached, so the browser scenario remains unverified in this handoff. No application-route or browser assertion failed.

## Query-plan evidence

`EXPLAIN (ANALYZE, BUFFERS)` was recorded locally for recent first/next pages, full text, BPM plus genre/tag, instrument plus open status, and trending. The empty post-reset catalog used the recent and trending covering indexes for first pages (about 0.18 ms and 0.05 ms). PostgreSQL reasonably chose tiny-table sequential scans for selective second-page/filter cases (all below 0.1 ms execution); the schema separately proves the GIN and keyset indexes exist. Production-like cardinality/load testing remains a release-hardening task rather than a reason to force planner nodes on an empty fixture.

## Deployment and remaining boundary

Apply `20260713203939_public_project_discovery.sql` before deploying the generated types and application. Existing projects remain private; there is no automatic publication. App rollback requires a forward corrective migration if schema behavior must change.

PR 16 intentionally does not add public audio previews, public buckets, autoplay, fuzzy/trigram search, personalized ranking, scheduled stats refresh, moderation, retention collection, or broader PR 17 dashboards/navigation.
