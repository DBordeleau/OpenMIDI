# Delivery Plan and Engineering Contract

Status: Accepted; M0–M3 complete and M4 contribution draft/submission implemented through PR 12

## Delivery strategy

Build thin vertical slices that end in observable user behavior. A focused Waveform Playlist integration spike precedes project persistence so the adapter, manifest round trip, browser behavior and bundle cost are proven early.

## Milestones

M0–M3 and the PR 12 contribution draft/submission portion of M4 are implemented. The current shell also includes an authenticated member-project index and active-route navigation; upload history excludes internal snapshot assets; and the pinned Next.js 16.2.10 studio omits the route loading boundary that caused a Firefox development refresh loop. Conditional manual browser/audio/Preview checks remain recorded in the corresponding evidence documents and are not represented as completed when they were not run. M4 review/acceptance and M5–M6 remain planned.

### M0 — Decisions and feasibility

Exit criteria:

- Waveform Playlist and direct playback/export package versions and licenses are inventoried and pinned.
- Waveform Playlist/Vercel spike passes the checks in the architecture document.
- Supported browser and upload-format matrix measured.
- Local Supabase development and preview deployment work.
- Architecture ADRs accepted; package versions pinned.

### M1 — Foundation and identity

- Next.js App Router, TypeScript strict mode, Tailwind and Motion.
- Supabase local migrations, generated DB types and seed data.
- Google OAuth. Additional identity providers are post-MVP.
- Onboarding, atomic username claim and public `@username` profile.
- Error reporting, structured logs, CI, unit/integration/E2E harness.

Exit: a new user can authenticate, claim a collision-safe username, edit a profile and view its public representation.

### M2 — Project and asset vertical slice

- Create private project, metadata and taxonomy selection.
- Resumable audio upload, verification lifecycle and signed playback.
- Automatic region-pinned source verification with durable leases, one bounded retry, idle-free recovery invocation, and owner-visible status.
- Draft workspace save with optimistic concurrency.
- Publish immutable revision and display project/player page.

Exit: an owner can publish a two-stem project, reload it and play synchronized audio.

### M3 — Integrated workspace

- Productionized Waveform Playlist adapter.
- Load signed assets, add/position a stem, mix controls, autosave and recovery.
- Authoritative portable manifest with deterministic editor hydration/export.
- Download/export with progress and failure recovery.

Exit: the defined MVP studio subset survives hard refresh and a new browser session.

### M4 — Contribution and review

- Contribution workspace based on an exact revision. **Implemented in PR 12 for already-authorized private-project members.**
- Submit immutable contribution version. **Implemented in PR 12 with versioned attestation and retained withdrawal history.**
- Owner review with A/B metadata and accept/reject/request-changes.
- Atomic accept creates a project revision; outdated base is surfaced.
- Credit snapshots and asset attribution.

Exit: a second account can contribute a stem and the owner can accept it without mutating prior history.

### M5 — Forking and discovery

- Copy-on-write fork with complete lineage and license checks.
- Browse/search filters for genre, tags, BPM, key and instrument.
- Recent and explainable trending ordering.
- Public profile project/contribution lists.

Exit: fork lineage is navigable and discovery results respect visibility/RLS.

### M6 — Launch hardening

- Enforced MVP storage quotas, abuse rate limits, reporting/manual moderation queue and retention job.
- Accessibility, performance budgets, browser compatibility and failure-mode tests.
- Backup/restore exercise and migration rehearsal.
- Security review of RLS, signed URLs, OAuth redirects and service-role usage.
- Legal copy and licenses approved.

## Testing pyramid

### Unit

- Username normalization and validation.
- Manifest parser/migrations and Waveform Playlist adapter mapping.
- Contribution state machine and permissions.
- Discovery query parsing and trending formula.

### Database integration

Run against local Supabase, not mocks:

- RLS tests for anonymous, author, unrelated user, member, owner and suspended user.
- Concurrent username claims produce one winner.
- Concurrent publishes create ordered revisions without lost updates.
- Acceptance is atomic and rejects an outdated base.
- Fork retention survives source soft-deletion.
- Unreferenced asset collector never removes referenced bytes.

### Browser/E2E

- OAuth callback can be supplemented by a test-only login path; production auth remains covered by an integration smoke test.
- Upload, synchronized playback, save/reload, submit, review, accept and fork.
- Expired signed URL refresh during a long studio session.
- Network interruption and resume during upload/autosave.
- Web Audio permission/suspension recovery and unsupported-browser messaging.

### Contract fixtures

Commit small, redistributable manifest and audio fixtures for every supported manifest/adapter compatibility version. CI must hydrate the editor model and round-trip the manifest deterministically. A package upgrade is incomplete until fixtures and migration compatibility pass.

## Non-functional targets for MVP

Targets should be validated with product analytics and adjusted deliberately:

- Public pages: Core Web Vitals “good” at the 75th percentile on supported devices.
- Product shell excludes Waveform Playlist, Tone.js and browser-audio code; the studio bundle loads only on the studio route.
- API/server mutation p95 under 750 ms excluding uploads and media processing.
- Workspace autosave is debounced, conflict-aware and visibly reports `saved`, `saving`, `offline` or `conflict`.
- No loss of an acknowledged published revision or submitted contribution.
- Signed source URLs expire in minutes, not days.
- Accessibility: WCAG 2.2 AA for the product shell and keyboard-operable core mixer controls.

## Observability

Use a request/correlation ID across server logs and background events. Record structured event names and IDs, not entire payloads.

Key metrics:

- OAuth/onboarding completion and username-claim failures.
- Upload started/completed/failed, bytes and processing latency.
- Studio boot success, engine version, load time and categorized failure.
- Autosave success/conflict/failure.
- Publish, submit, accept, reject and fork success/failure.
- Signed URL authorization denial rate.
- Storage bytes by asset status and orphan candidate count.

Alert on sustained publish failures, asset-processing backlog, elevated auth callback failures and revision/storage referential-integrity errors.

## Migration rules

- SQL migrations are forward-only, timestamped and reviewed.
- Every destructive change uses expand/migrate/contract across deployments.
- New non-null columns on populated tables are added nullable or with safe defaults, backfilled in bounded batches, then constrained.
- RLS policy changes include integration tests in the same change.
- Seed data uses stable identifiers/slugs and contains no production data.
- Production migration and deploy ordering is written in the PR when compatibility matters.

## Coding-agent task contract

Every implementation task should contain:

1. **Outcome** — one user-visible or architectural result.
2. **Context** — exact PRD section, design document and ADR links.
3. **Scope** — files/features allowed to change and explicit non-goals.
4. **Invariants** — authorization, immutability, transaction and compatibility rules.
5. **Acceptance criteria** — observable Given/When/Then behavior.
6. **Verification** — exact commands plus manual checks where audio behavior is involved.
7. **Artifacts** — migration, generated types, tests and docs expected.

Agents must inspect existing migrations and feature boundaries before editing. They must not invent schema names that conflict with this design, bypass RLS with the service role, expose Storage buckets for convenience, or import Waveform Playlist/Tone.js outside the adapter boundary.

Recommended task size: one vertical behavior or one safe refactor, normally reviewable in under roughly 400 changed lines excluding generated files/migrations. Larger outcomes should be sequenced so the application remains runnable after each merge.

## Definition of done

A change is done when:

- Acceptance criteria pass and unhappy paths are covered.
- Type checking, linting, unit tests and affected integration/E2E tests pass.
- Authorization is tested with at least an allowed and denied actor.
- Migrations apply from a clean database and generated types are current.
- Loading/performance impact is measured for studio changes.
- User-facing errors are actionable and telemetry avoids sensitive content.
- Relevant design/ADR documentation is updated if behavior changed.

## Risk register

| Risk                                              | Impact                       | Mitigation/trigger                                                                                                  |
| ------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Waveform Playlist API/package changes             | Rework or reopen regressions | Exact version pins, adapter boundary, deterministic manifest fixtures, explicit upgrades                            |
| MVP editor lacks a required collaboration action  | Product gap                  | Prove the promoted subset in PR 05; fall back to lower-level Waveform engine/Tone.js, and consider OpenDAW post-MVP |
| Vercel/browser worker or isolation constraints    | Studio failure               | Preview-deploy spike and CSP/header tests                                                                           |
| Large audio uploads exceed request/runtime limits | Failed uploads/cost          | Direct resumable Storage uploads and async processing                                                               |
| RLS complexity leaks private audio                | Severe privacy issue         | Deny-by-default policies, role-matrix tests, short-lived signed URLs                                                |
| Forks/deletes break asset ownership               | Data loss                    | Immutable asset IDs, reference-aware retention, copy-on-write lineage                                               |
| “Merge” semantics are ambiguous for audio         | User confusion               | Snapshot acceptance; reject stale bases; no automatic merge in MVP                                                  |
| Browser memory/CPU limits                         | Poor studio UX               | Published limits, lazy loading, measured browser matrix, graceful block                                             |
