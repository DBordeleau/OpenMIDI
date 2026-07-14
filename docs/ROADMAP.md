# Jam Session MVP Roadmap

Status: Active  
Last updated: 2026-07-13  
Repository checkpoint: PRs 01–17 complete; PR 18 is next

## Purpose

This is the tracked, contributor-facing delivery roadmap for the Jam Session MVP. It explains what has shipped in the repository, what comes next, how the remaining work is sequenced, and what “MVP complete” means.

Use this document to choose and scope the next product slice. Use the [PRD](PRD.md) for product intent and MVP boundaries, the [technical design](technical-design/README.md) for architecture and persistence contracts, the [brand guide](design/brand.md) for user-facing presentation, and the [contribution guide](../CONTRIBUTING.md) for development workflow.

Implementation status here refers to the merged repository. It does not prove that a migration, Edge Function, environment variable, or application build has been deployed to a hosted environment. Deployment evidence belongs in the relevant technical evidence/runbook.

## Current checkpoint

Jam Session has completed the product foundation, browser workspace, collaboration graph, public discovery, profiles, dashboard, and navigation slices.

The current MVP supports:

- invite-only Google authentication, onboarding, safe public profiles, and private account data;
- private projects with controlled metadata, membership, and optimistic updates;
- immutable WAV/FLAC/MP3 source assets uploaded directly to private Supabase Storage;
- durable trusted source verification, explicit ordered credits, and quota enforcement;
- immutable project revisions and browser-only Waveform Playlist playback/editing;
- conflict-safe private workspaces, recovery snapshots, export/download, and later-revision publishing;
- private contribution drafts, immutable submissions, owner review, rejection/request changes, and atomic acceptance;
- immutable publisher/contributor/track credit snapshots;
- copy-on-write forks with exact lineage and no source-byte duplication;
- owner-controlled public projects, bounded Explore search/filtering, and privacy-safe public project pages;
- independently paginated public profile history, sanitized avatars, bounded private indexes, and an authenticated dashboard;
- responsive shared navigation following the landing-page brand system; and
- branded latest-revision previews on Explore and project pages, one-action studio entry, and owner soft deletion with a 30-day recovery window.

The next slice is **PR 18 — Moderation, retention, quotas, and storage operations**. It completes Phase E by adding manual community-safety operations and reference-safe cleanup. PRs 19–20 are final hardening and release gates, not buckets for known feature debt.

### Progress at a glance

| Phase | Theme                          | PRs     | Status            | Exit outcome                                                                              |
| ----- | ------------------------------ | ------- | ----------------- | ----------------------------------------------------------------------------------------- |
| A     | Backend and product foundation | 01–04   | Complete          | Local/remote Supabase foundation, responsive shell, tested identity/RLS, and onboarding   |
| B     | Feasibility and core domain    | 05–08   | Complete          | Browser-audio risk retired; private projects, assets, and immutable first publishing work |
| C     | Browser workspace              | 09–11.5 | Complete          | Users can play, edit, autosave, reopen, export, publish, and recover source verification  |
| D     | Collaboration graph            | 12–15   | Complete          | Contributions, review/acceptance, attribution, and copy-on-write forks work end to end    |
| E     | Discovery and community safety | 16–18   | In progress (2/3) | Public discovery/profiles are complete; moderation and retention operations are next      |
| F     | MVP hardening and release      | 19–20   | Pending           | Measured hardening and a rehearsed invited-user deployment                                |

## Delivery principles

Every roadmap PR is a reviewable vertical slice with one observable user or operator outcome. A slice includes its schema/RLS changes, application behavior, tests, documentation, and deployment ordering when applicable.

Across all slices:

- Postgres is authoritative for domain relationships and authorization; Storage holds bytes.
- Published revisions and submitted contribution versions are immutable.
- Source audio stays private and is authorized before short-lived signed access.
- Browser audio/editor dependencies stay inside the documented client-only studio adapter.
- Large bytes upload/download directly through Storage, not through Vercel Functions.
- Public projections expose only deliberately safe fields and never Auth email.
- RLS and service/data boundaries enforce authorization; navigation and hidden controls do not.
- New lists and queues are bounded and indexed; use keyset pagination where depth can grow.
- Cleanup is reference-aware and hold-aware so surviving revisions, contributions, and forks cannot break.
- User-facing work follows the tracked brand guide and shared component patterns.
- Verification is proportional: focused checks while iterating, then each applicable broad merge gate once.

## Phase A — Backend and product foundation

Status: Complete

### PR 01 — Supabase local development and typed infrastructure

**Outcome:** Contributors can start/reset local Supabase, run database tests, and generate deterministic TypeScript database types without connecting to production.

**Delivered:** Pinned npm tooling, local Supabase configuration, forward migrations, seed/test scaffolding, generated-type drift checks, environment separation, and server/browser client boundaries.

### PR 02 — Product shell and foundational UI system

**Outcome:** Future pages compose a responsive, accessible product shell instead of recreating layout/navigation primitives.

**Delivered:** Global shell, responsive layout, semantic shared controls, accessible navigation/focus treatment, baseline loading/error/empty patterns, and repository quality commands.

### PR 03 — Identity schema, authorization foundation, and test actors

**Outcome:** Profile/account data and reusable RLS tests exist before OAuth UI depends on them.

**Delivered:** Profile lifecycle, atomic normalized username claims, safe public projection, private administrator mapping, RLS actor matrix, Auth hook, and local/CI test actors.

### PR 04 — Google authentication, onboarding, and public profiles

**Outcome:** An invited user can sign in with Google, complete onboarding, edit a profile, sign out, and view a safe public `@username` page.

**Delivered:** Invite enforcement, verified OAuth callback handling, sanitized next destinations, incomplete-profile gating, settings, progressive account links, and production-inaccessible test Auth.

## Phase B — Feasibility and core domain

Status: Complete

### PR 05 — Waveform Playlist/Vercel integration spike and adapter contract

**Outcome:** The selected browser editor and Jam Session manifest boundary are proven before domain data depends on editor internals.

**Delivered:** Browser-only lazy adapter, deterministic manifest round trips, synchronized playback/export evidence, server-build isolation, pinned dependency versions, and licensing notices.

### PR 06 — Project metadata, membership, taxonomy, and creation

**Outcome:** An authenticated user can create, edit, and view a private project with validated musical metadata.

**Delivered:** Project/member schema, single-owner invariant, controlled licenses/genres/tags/instruments, idempotent creation, optimistic updates, private RLS, and member project routes.

### PR 07 — Immutable asset admission and direct resumable uploads

**Outcome:** Users can upload valid private source audio directly to Storage with resumability, validation, and quota reservation.

**Delivered:** Immutable asset identity, private bucket/path policy, TUS uploads, file/type/size limits, user/global quota caches, source-only upload history, and admission/failure state contracts.

### PR 08 — Immutable project revisions and first publish flow

**Outcome:** An owner can publish uploaded assets as an atomic first immutable project revision.

**Delivered:** Versioned manifest validation, immutable revision/track projections, project asset references, project usage accounting, idempotent/concurrent publish, and durable project history.

## Phase C — Browser workspace

Status: Complete

### PR 09 — Production Waveform Playlist adapter and synchronized project playback

**Outcome:** Authorized users can open a published revision and reliably play synchronized signed stems.

**Delivered:** Production lazy studio adapter, signed-source loading, synchronized transport/seek/mixer behavior, URL refresh, initialized-state guards, and unsupported-browser messaging.

### PR 10 — Editable workspaces and conflict-safe autosave

**Outcome:** An owner can edit a private workspace and reopen the exact draft without silent conflict loss.

**Delivered:** Workspace manifests/tracks, private snapshots, add/reposition/mix controls, debounced autosave, optimistic lock conflicts, offline/pending states, and local crash recovery.

### PR 11 — Export, download, and workspace publishing

**Outcome:** Owners can publish a workspace as a later immutable revision and authorized users can download/export supported artifacts.

**Delivered:** Atomic workspace publication, stale-draft restart, direct sequential stem downloads plus manifest descriptor, bounded browser-rendered WAV mix export, and cancellation/failure handling.

### PR 11.5 — Automatic source-audio verification worker

**Outcome:** Completed source uploads are verified automatically through a durable trusted worker rather than relying on manual operation.

**Delivered:** Private verification jobs, authenticated Edge invocation, service-role lease/finalization, bounded retry/recovery, trusted media metadata, status polling, and operator fallback.

## Phase D — Collaboration graph

Status: Complete

### PR 12 — Contribution drafts and immutable submission versions

**Outcome:** An authorized non-owner can create a contribution workspace and submit an immutable proposal based on an exact revision.

**Delivered:** Private contribution state machine, contribution workspaces, immutable attested versions/tracks, resubmission, withdrawal with retained history, and author/owner RLS.

### PR 13 — Owner review and atomic contribution acceptance

**Outcome:** A project owner can audition, request changes, reject, or atomically accept an exact contribution version.

**Delivered:** Immutable review attempts, participant-private notes, exact-version audition/download, stale-base fallback, and acceptance that creates one new immutable project revision transactionally.

### PR 14 — Attribution and immutable credit presentation

**Outcome:** Published tracks/revisions credit creators durably even after profile changes or deletion.

**Delivered:** Explicit ordered source-credit confirmation, immutable revision track credits, separate publisher/accepted-contributor snapshots, and privacy-safe profile/history presentation.

### PR 15 — Copy-on-write forks and navigable lineage

**Outcome:** Authorized users can fork a permitted revision without duplicating source audio and can navigate parent/child lineage safely.

**Delivered:** Idempotent fork transaction, exact immutable lineage, inherited licensing/taxonomy/credits, copied revision metadata with shared assets, private defaults, bounded children, and unavailable-parent fallback.

## Phase E — Discovery and community safety

Status: In progress — PRs 16–17 complete; PR 18 next

### PR 16 — Public project pages, browse, and efficient search

**Status:** Complete

**Outcome:** Anonymous and authenticated users can discover public projects using useful, bounded, shareable filters.

**Delivered:** Owner-controlled public visibility, safe public catalog, public metadata/credit pages, indexed full-text/filter search, deterministic recent/trending order, keyset pagination, and public contribution/fork entry without public source audio.

### PR 17 — Complete profiles, dashboard, and navigation

**Status:** Complete

**Outcome:** Public profiles show created projects/accepted contributions, while members receive efficient private navigation and work summaries.

**Delivered:** Independently paginated profile history, trusted private-original/public-derived avatars, bounded dashboard/project/contribution queries, throttled activity, responsive disclosure navigation, and shared landing-page button treatment.

### PR 18 — Moderation, retention, quotas, and storage operations

**Status:** Next

**Outcome:** The invited demo can be operated safely within Supabase Free limits using manual reports and deterministic cleanup that cannot break surviving history.

**Planned scope:**

- private moderation reports/actions and legal/abuse holds with administrator-only detail and commands;
- report actions for profiles, projects, and contributions plus reporter-safe status;
- a bounded manual administrator queue and explicit hide/restore/suspend/reject operations;
- actual Storage usage by bucket, a 750 MiB administrator warning, and conservative 850 MiB admission enforcement;
- dry-run-first cleanup for incomplete uploads (24 hours), abandoned workspaces and recoverable deletion (30 days), and eligible moderation/audit metadata (180 days);
- centralized reference/hold checks covering revisions, workspaces, contribution versions, forks, avatars, and processing jobs;
- community rules, reporting/deletion/recovery copy, and an administrator runbook; and
- a manual-first idempotent operator command, with Supabase Cron optional rather than required for launch.

**Acceptance gate:** Reports never auto-hide; only a database-verified administrator can act; unrelated users cannot see reports; dry runs are inspectable; live references and holds always block deletion; repeated cleanup is safe; actual-object capacity and domain accounting are reconciled.

**Non-goals:** Automated content scanning, a complex appeals portal, full legal compliance automation, or an external moderation processor.

## Phase F — MVP hardening and release

Status: Pending

### PR 19 — Performance, accessibility, resilience, and security hardening

**Status:** Pending after PR 18

**Outcome:** The complete MVP is measured and hardened against realistic failure modes before inviting users.

**Planned scope:**

- measured budgets for public/studio JavaScript, audio/image requests, Web Vitals, and studio boot;
- audit of Server/Client boundaries, query counts, cache scopes, signed URL refresh, and source prefetch;
- WCAG 2.2 AA review of shell/core workflows and reduced-motion/keyboard behavior;
- browser compatibility, offline/network recovery, memory limits, and actionable error states;
- dependency/license/CSP/security-header review, RLS and signed-URL audit, abuse rate limits, and sensitive-log review; and
- backup/restore, retention, and operational failure-mode evidence.

**Acceptance gate:** Budgets/browser matrix pass or document accepted exceptions; no high/critical dependency or severe authorization finding remains; core workflows are keyboard-usable and preserve acknowledged work during failure.

### PR 20 — Vercel/Supabase invited MVP release rehearsal

**Status:** Final gate

**Outcome:** A repeatable preview/production deployment is ready for approximately 20 invited users with rollback and recovery understood.

**Planned scope:**

- finalized environment separation, deployment order, migrations, Edge Functions, secrets, OAuth URLs, and storage policies;
- staged end-to-end rehearsal from invite/onboarding through upload, workspace, publish, contribution acceptance, fork, and discovery;
- production smoke tests, migration rehearsal, rollback, database export/restore, and operator runbook verification;
- storage/egress/function baseline plus alert/manual-check ownership; and
- release checklist, known limitations, support path, community rules, third-party notices, and evidence index.

**Acceptance gate:** The critical invited-user journey succeeds in the authorized hosted environment; rollback/export are rehearsed; operational ownership and capacity baselines are recorded.

**Non-goal:** Public launch or paid-SLA operations.

## Dependency and sequencing rules

- PRs within a phase are ordered unless a tracked decision explicitly says otherwise.
- PR 18 follows all current reference types so retention can prove that surviving history is safe.
- PR 19 begins only after functional PR 18 correctness is complete; it is not a place to defer known authorization or retention debt.
- PR 20 begins only after PR 19 hardening evidence and all required hosted configuration decisions are available.
- Schema changes are forward-only and ship with generated types plus affected RLS/integration tests.
- Changes to immutable history, contribution acceptance, fork lineage, persisted manifests, storage privacy, or editor boundaries require an explicit updated design/ADR before implementation.
- Hosted migrations, production cleanup, secrets, administrator assignment, and deployment are separate authorized operations; a local green check does not imply they occurred.

## Remaining product and operational decisions

These do not block PR 18's documented manual-first MVP unless its implementation reaches the decision boundary:

| Decision                                                          | Needed by              | Current default                                                                            |
| ----------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| Formal copyright/takedown contact and appeal path                 | PR 20/legal review     | Publish community rules and manual administrator handling; do not claim full compliance    |
| Whether to enable Supabase Cron/Vault cleanup scheduling          | PR 20 operations       | Manual dry-run/execute command remains authoritative                                       |
| Final supported browser/device matrix                             | PR 19                  | Current stable Chrome/Edge/Safari/Firefox desktop; responsive mobile pages, desktop studio |
| Production observability/alert ownership                          | PR 20                  | Structured safe logs plus documented manual checks                                         |
| Production environment/rollback approvers                         | PR 20                  | No hosted mutation without explicit authorization                                          |
| Default project license and final contributor attestation wording | Before invited release | Preserve current versioned contracts until formally approved                               |

## Definition of MVP complete

The invited MVP is complete only when:

1. An invited user can authenticate, onboard, and manage a safe public profile.
2. A creator can upload verified audio, publish immutable revisions, edit/reopen a workspace, download stems, and export a mix.
3. A second authorized user can submit an immutable contribution that the owner can review and atomically accept without rewriting history.
4. Credits remain correct across acceptance, profile changes, deletion, and copy-on-write forks.
5. Public projects/profiles can be discovered without exposing private audio or participant-private state.
6. Reporting, administrator action, holds, quotas, retention, and reference-safe cleanup are operational.
7. Performance, accessibility, security, resilience, dependency, and browser gates have evidence or explicit accepted exceptions.
8. The invited hosted deployment, rollback, export/restore, capacity checks, and operator runbooks are rehearsed.
9. Product/technical/brand/operations documentation matches the deployed behavior and known limitations.

## Maintaining this roadmap

Update this file in the same PR when:

- a roadmap slice begins, completes, is split, or materially changes scope;
- an implementation outcome differs intentionally from the planned outcome;
- the “next PR” changes;
- a phase exit is reached;
- a new blocking product/operational decision appears; or
- release sequencing changes.

Keep detailed implementation checklists out of this roadmap. Those may exist as temporary planning artifacts, but this tracked document is the contributor-facing authority for sequence and status. Evidence documents remain the authority for what was actually verified.
