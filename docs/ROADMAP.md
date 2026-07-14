# Jam Session MVP Roadmap

Status: Active  
Last updated: 2026-07-14

Repository checkpoint: PRs 01–17 complete; the audio-optimization and MIDI-first interruption slices precede PR 18

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

The next work is a deliberate two-part roadmap interruption before PR 18:

1. **`OPT-01`–`OPT-05` — $0 audio-delivery optimization:** measure the current path, render the studio before audio finishes, progressively load stems, add lossless browser WAV-to-FLAC optimization and persisted peaks, and verify realistic cold/warm budgets.
2. **`MIDI-01`–`MIDI-07` — MIDI-first MVP expansion:** add a versioned MIDI workspace, deterministic bundled synth presets, piano-roll editing and recording, immutable MIDI collaboration/history, then disable admission of new source audio without breaking existing audio history.

After both interruptions complete, **PR 18 — Moderation, retention, quotas, and storage operations** resumes with legacy audio, derived peaks/previews, and MIDI relational history included in its reference and capacity model. PRs 19–20 remain final hardening and release gates, not buckets for known feature debt.

### Progress at a glance

| Phase | Theme                          | PRs             | Status            | Exit outcome                                                                              |
| ----- | ------------------------------ | --------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| A     | Backend and product foundation | 01–04           | Complete          | Local/remote Supabase foundation, responsive shell, tested identity/RLS, and onboarding   |
| B     | Feasibility and core domain    | 05–08           | Complete          | Browser-audio risk retired; private projects, assets, and immutable first publishing work |
| C     | Browser workspace              | 09–11.5         | Complete          | Users can play, edit, autosave, reopen, export, publish, and recover source verification  |
| D     | Collaboration graph            | 12–15           | Complete          | Contributions, review/acceptance, attribution, and copy-on-write forks work end to end    |
| O     | $0 audio optimization          | OPT-01–OPT-05   | In progress (2/5) | Studio is usable before stems finish and legacy audio has measured efficient delivery     |
| M     | MIDI-first MVP expansion       | MIDI-01–MIDI-07 | Pending after O   | MIDI is the active creation path; new audio admission is disabled without history loss    |
| E     | Discovery and community safety | 16–18           | Paused (2/3)      | Public discovery/profiles are complete; PR 18 resumes after the interruption slices       |
| F     | MVP hardening and release      | 19–20           | Pending           | Measured hardening and a rehearsed invited-user deployment                                |

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

Status: Paused — PRs 16–17 complete; optimization and MIDI expansion precede PR 18

### PR 16 — Public project pages, browse, and efficient search

**Status:** Complete

**Outcome:** Anonymous and authenticated users can discover public projects using useful, bounded, shareable filters.

**Delivered:** Owner-controlled public visibility, safe public catalog, public metadata/credit pages, indexed full-text/filter search, deterministic recent/trending order, keyset pagination, and public contribution/fork entry without public source audio.

### PR 17 — Complete profiles, dashboard, and navigation

**Status:** Complete

**Outcome:** Public profiles show created projects/accepted contributions, while members receive efficient private navigation and work summaries.

**Delivered:** Independently paginated profile history, trusted private-original/public-derived avatars, bounded dashboard/project/contribution queries, throttled activity, responsive disclosure navigation, and shared landing-page button treatment.

## Roadmap interruption O — $0 audio optimization

**Status:** In progress — OPT-01 and OPT-02 complete; OPT-03 next

**Outcome:** Existing and legacy audio projects remain practical on free infrastructure: the studio becomes usable before complete stem decoding, WAV uploads can be optimized losslessly in capable browsers, and real waveform peaks plus honest readiness states improve perceived startup.

**Slices:** `OPT-01` baseline/instrumentation; `OPT-02` immediate progressive studio; `OPT-03` browser WAV-to-FLAC; `OPT-04` persisted peaks; `OPT-05` measurement, hardening, and optional browser-produced revision preview.

**Delivered in OPT-01:** Reproducible ignored large-audio fixtures; development-only route/adapter/source/shell/peaks/playback timing marks; controlled/stress/boundary baseline evidence; and selection of pinned `mediabunny@1.50.8` + `@mediabunny/flac-encoder@1.50.8` for later worker integration. No production upload, schema, Storage, or caching behavior changed. See the [OPT-01 evidence](technical-design/evidence/opt-01-audio-delivery-baseline.md).

**Delivered in OPT-02:** Manifest-first placeholder lanes and safe workspace controls; progressive per-track fetch/decode attachment; accessible readiness/failure states; audible-track playback gating; isolated retry/cancellation; and bounded actor-scoped in-memory promise/buffer reuse. The controlled cold WAV harness reaches shell-ready in 7 ms median/48 ms slowest while playback remains network-bound near 29.4 seconds; primed same-session repeats avoid transfer and decode. No schema, RLS, Storage object, source byte, manifest, or publication contract changed. See the [OPT-02 evidence](technical-design/evidence/opt-02-progressive-studio.md).

**Acceptance gate:** A controlled cold three-stem project renders its editable shell within two seconds; audio quality and private authorization are unchanged; new losslessly optimized sources target 8–12 seconds to synchronized cold playback and 2–4 seconds warm; no paid worker or service is required.

## Roadmap interruption M — MIDI-first MVP expansion

**Status:** Pending after interruption O

**Outcome:** MIDI becomes the prototype's active creation and collaboration path, with multiple deterministic synth tracks, accessible piano-roll editing, recording, immutable publication/contributions/forks, previews, and `.mid` export. New source-audio admission is disabled only after that complete path works.

**Slices:** `MIDI-01` format/engine gate; `MIDI-02` MIDI project/playback foundation; `MIDI-03` piano roll/clips; `MIDI-04` audition/recording; `MIDI-05` publish/preview/export; `MIDI-06` contributions/credits/forks; `MIDI-07` audio-admission lock and compatibility hardening.

**Compatibility contract:** This is not a billing implementation. New projects become MIDI-first and the source reservation authority rejects new audio after transition. Existing audio projects, workspaces, revisions, contributions, forks, credits, playback, downloads, and exports remain private, supported, and immutable; no history is converted or deleted.

**Acceptance gate:** A new user can create, record/edit, save/reload, publish, preview, contribute to, accept, fork, and export a MIDI project without uploaded audio; old clients cannot bypass the audio-admission lock; existing audio regression journeys still pass.

### PR 18 — Moderation, retention, quotas, and storage operations

**Status:** Pending after interruptions O and M

**Outcome:** The invited demo can be operated safely within Supabase Free limits using manual reports and deterministic cleanup that cannot break surviving history.

**Planned scope:**

- private moderation reports/actions and legal/abuse holds with administrator-only detail and commands;
- report actions for profiles, projects, and contributions plus reporter-safe status;
- a bounded manual administrator queue and explicit hide/restore/suspend/reject operations;
- actual Storage usage by bucket, a 750 MiB administrator warning, and conservative 850 MiB admission enforcement;
- dry-run-first cleanup for incomplete uploads (24 hours), abandoned workspaces and recoverable deletion (30 days), and eligible moderation/audit metadata (180 days);
- centralized reference/hold checks covering audio/MIDI revisions, workspaces, contribution versions, forks, avatars, derived peaks/previews, and processing jobs;
- separate database-growth reporting for MIDI relational data and Storage reporting for retained legacy audio/derived objects, while explaining that new source admission is disabled;
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

- measured budgets for public/studio JavaScript, MIDI/audio/image requests, Web Vitals, MIDI scheduling, and studio boot;
- audit of Server/Client boundaries, query counts, cache scopes, signed URL refresh, and source prefetch;
- WCAG 2.2 AA review of shell/core workflows and reduced-motion/keyboard behavior;
- browser compatibility including Web MIDI fallback, offline/network recovery, synth/audio memory/voice limits, and actionable error states;
- dependency/license/CSP/security-header review, RLS and signed-URL audit, abuse rate limits, and sensitive-log review; and
- backup/restore, retention, and operational failure-mode evidence.

**Acceptance gate:** Budgets/browser matrix pass or document accepted exceptions; no high/critical dependency or severe authorization finding remains; core workflows are keyboard-usable and preserve acknowledged work during failure.

### PR 20 — Vercel/Supabase invited MVP release rehearsal

**Status:** Final gate

**Outcome:** A repeatable preview/production deployment is ready for approximately 20 invited users with rollback and recovery understood.

**Planned scope:**

- finalized environment separation, deployment order, migrations, Edge Functions, secrets, OAuth URLs, and storage policies;
- staged end-to-end rehearsal from invite/onboarding through MIDI creation/recording, workspace, publish, contribution acceptance, fork, discovery, export, and legacy-audio compatibility;
- production smoke tests, migration rehearsal, rollback, database export/restore, and operator runbook verification;
- storage/egress/function baseline plus alert/manual-check ownership; and
- release checklist, known limitations, support path, community rules, third-party notices, and evidence index.

**Acceptance gate:** The critical invited-user journey succeeds in the authorized hosted environment; rollback/export are rehearsed; operational ownership and capacity baselines are recorded.

**Non-goal:** Public launch or paid-SLA operations.

## Dependency and sequencing rules

- PRs within a phase or named interruption are ordered unless a tracked decision explicitly says otherwise.
- `OPT-01`–`OPT-05` complete before `MIDI-01`; `MIDI-01`–`MIDI-07` complete before PR 18.
- The audio-admission lock is enabled only after the complete MIDI parity gate; it is enforced by source reservation authority, not hidden controls.
- PR 18 follows all audio, derived-asset, and MIDI reference types so retention can prove that surviving history is safe.
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
| Future storage solution and any audio-access model                | Post-MVP               | No billing schema; global new-audio admission remains disabled after the MIDI transition   |

## Definition of MVP complete

The invited MVP is complete only when:

1. An invited user can authenticate, onboard, and manage a safe public profile.
2. A creator can record/edit MIDI tracks, publish immutable revisions, preview them, reopen a workspace, and export standard MIDI; existing audio creators retain authorized playback/download/export access.
3. A second authorized user can submit an immutable MIDI or compatible legacy contribution that the owner can review and atomically accept without rewriting history.
4. Credits remain correct across acceptance, profile changes, deletion, and copy-on-write forks.
5. Public projects/profiles can be discovered and previewed without exposing private legacy audio or participant-private state.
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
