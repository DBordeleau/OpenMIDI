# Jam Session MVP Roadmap

Status: Active  
Last updated: 2026-07-15

Repository checkpoint: PRs 01–17, OPT-01–OPT-05, MIDI-01–MIDI-07, STUDIO-01–STUDIO-06, and UX-01–UX-05 complete; the Studio usability pulse is accepted, leaving hosted evidence acceptance and the separately authorized audio-lock transition before PR 18

## Purpose

This is the tracked, contributor-facing delivery roadmap for the Jam Session MVP. It explains what has shipped in the repository, what comes next, how the remaining work is sequenced, and what “MVP complete” means.

Use this document to choose and scope the next product slice. Use the [PRD](PRD.md) for product intent and MVP boundaries, the [technical design](technical-design/README.md) for architecture and persistence contracts, the [brand guide](design/brand.md) for user-facing presentation, and the [contribution guide](../CONTRIBUTING.md) for development workflow.

Implementation status here refers to the merged repository. It does not prove that a migration, Edge Function, environment variable, or application build has been deployed to a hosted environment. Deployment evidence belongs in the relevant technical evidence/runbook.

## Current checkpoint

Jam Session has completed the product foundation, browser workspace, collaboration graph, public discovery, profiles, dashboard, navigation, and $0 audio-optimization slices.

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
- executable MIDI v2/session/scheduler contracts, deterministic sample-free presets, conflict-safe MIDI stem drafts/immutable versions, accessible standalone composition/recording, exact-version project publication, and complete MIDI contribution/acceptance/credit/fork behavior.

The remaining roadmap programs and gates before PR 18 are:

1. **`MIDI-01`–`MIDI-07` — MIDI-first foundation and transition readiness:** complete. The versioned stem/editor/runtime/collaboration path and reversible source-admission capability are implemented and tested while admission remains enabled.
2. **`STUDIO-01`–`STUDIO-06` — Studio-native creation and arrangement:** repository complete. Hosted parity acceptance and the separately authorized source-admission transition remain operational gates.
3. **`UX-01`–`UX-05` — Studio and MIDI usability:** complete with its milestone pulse accepted. This bounded pass repairs transport/mixer correctness, establishes a familiar DAW shell and inline track workflow, improves piano interaction, and adds spatial block editing without changing immutable history or manifest compatibility.

After the UX pass and hosted capability handoff complete, **PR 18 — Moderation, retention, quotas, and storage operations** resumes with legacy audio, derived peaks, and MIDI relational history included in its reference and capacity model. Any separately approved audio preview must be included only if it lands before PR 18 re-anchors. PRs 19–20 remain final hardening and release gates, not buckets for known feature debt.

### Progress at a glance

| Phase | Theme                          | PRs             | Status              | Exit outcome                                                                               |
| ----- | ------------------------------ | --------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| A     | Backend and product foundation | 01–04           | Complete            | Local/remote Supabase foundation, responsive shell, tested identity/RLS, and onboarding    |
| B     | Feasibility and core domain    | 05–08           | Complete            | Browser-audio risk retired; private projects, assets, and immutable first publishing work  |
| C     | Browser workspace              | 09–11.5         | Complete            | Users can play, edit, autosave, reopen, export, publish, and recover source verification   |
| D     | Collaboration graph            | 12–15           | Complete            | Contributions, review/acceptance, attribution, and copy-on-write forks work end to end     |
| O     | $0 audio optimization          | OPT-01–OPT-05   | Complete            | Studio is usable before stems finish and legacy audio has measured efficient delivery      |
| M     | MIDI-first MVP expansion       | MIDI-01–MIDI-07 | Complete            | MIDI foundations and reversible transition control are complete; admission remains enabled |
| S     | Studio-forward workspace       | STUDIO-01–06    | Repository complete | Studio is the primary creation path; hosted acceptance and lock transition remain          |
| U     | Studio and MIDI usability      | UX-01–UX-05     | Repository complete | Studio transport, workflow, piano interaction, and block editing are musician-ready        |
| E     | Discovery and community safety | 16–18           | Paused (2/3)        | Public discovery/profiles are complete; PR 18 resumes after the interruption slices        |
| F     | MVP hardening and release      | 19–20           | Pending             | Measured hardening and a rehearsed invited-user deployment                                 |

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

Status: Paused — PRs 16–17 complete; optimization is complete and MIDI/studio-forward programs precede PR 18

### PR 16 — Public project pages, browse, and efficient search

**Status:** Complete

**Outcome:** Anonymous and authenticated users can discover public projects using useful, bounded, shareable filters.

**Delivered:** Owner-controlled public visibility, safe public catalog, public metadata/credit pages, indexed full-text/filter search, deterministic recent/trending order, keyset pagination, and public contribution/fork entry without public source audio.

### PR 17 — Complete profiles, dashboard, and navigation

**Status:** Complete

**Outcome:** Public profiles show created projects/accepted contributions, while members receive efficient private navigation and work summaries.

**Delivered:** Independently paginated profile history, trusted private-original/public-derived avatars, bounded dashboard/project/contribution queries, throttled activity, responsive disclosure navigation, and shared landing-page button treatment.

## Roadmap interruption O — $0 audio optimization

**Status:** Complete — OPT-01 through OPT-05

**Outcome:** Existing and legacy audio projects remain practical on free infrastructure: the studio becomes usable before complete stem decoding, WAV uploads can be optimized losslessly in capable browsers, and real waveform peaks plus honest readiness states improve perceived startup.

**Slices:** `OPT-01` baseline/instrumentation; `OPT-02` immediate progressive studio; `OPT-03` browser WAV-to-FLAC; `OPT-04` persisted peaks; `OPT-05` measurement, hardening, and optional browser-produced revision preview.

**Delivered in OPT-01:** Reproducible ignored large-audio fixtures; development-only route/adapter/source/shell/peaks/playback timing marks; controlled/stress/boundary baseline evidence; and selection of pinned `mediabunny@1.50.8` + `@mediabunny/flac-encoder@1.50.8` for later worker integration. No production upload, schema, Storage, or caching behavior changed. See the [OPT-01 evidence](technical-design/evidence/opt-01-audio-delivery-baseline.md).

**Delivered in OPT-02:** Manifest-first placeholder lanes and safe workspace controls; progressive per-track fetch/decode attachment; accessible readiness/failure states; audible-track playback gating; isolated retry/cancellation; and bounded actor-scoped in-memory promise/buffer reuse. The controlled cold WAV harness reaches shell-ready in 7 ms median/48 ms slowest while playback remains network-bound near 29.4 seconds; primed same-session repeats avoid transfer and decode. No schema, RLS, Storage object, source byte, manifest, or publication contract changed. See the [OPT-02 evidence](technical-design/evidence/opt-02-progressive-studio.md).

**Delivered in OPT-03:** Exact-pinned Mediabunny/libFLAC encoding in a dynamically imported dedicated browser worker; an explicit WAV lossless-optimization choice with progress, cancellation, capability/memory/failure fallback; same-decoded-PCM transient peak generation for OPT-04; output signature/metadata/limit validation before reservation; unchanged FLAC/MP3 upload candidates; canonical FLAC direct resumable upload and trusted verification; and accurate full-quality download copy. No schema, RLS, Storage policy, quota, manifest, or existing asset changed. See the [OPT-03 evidence](technical-design/evidence/opt-03-browser-lossless-upload.md).

**Delivered in OPT-04:** Compact source-bound `JSPK` v1 peak derivatives; owner-only direct private upload coordination and server-side byte finalization; exact RLS/Storage authorization inherited from canonical source access; global derived-capacity accounting outside user source quota; signed small peak descriptors; and peaks-first adapter hydration with malformed/missing/stale fallback to placeholders and decoded audio. Existing assets require no backfill, source verification remains authoritative, and manifests remain unchanged. See the [OPT-04 evidence](technical-design/evidence/opt-04-persisted-waveform-peaks.md).

**Delivered in OPT-05:** Exact production-pinned browser FLAC fixture generation with source/output metadata and full decoded-PCM equality proof; final five-run WAV/FLAC cold and same-session measurements; 12-stem and near-10-minute capability results; Free-plan capacity/egress monitoring guidance; and the compatibility handoff to MIDI. The controlled FLAC path is 40.24% smaller and improves median cold playback from 29.267 s to 17.709 s while retaining a 5 ms median shell and zero-byte warm reuse. It misses the 8–12 s cold target because 42.7 MB has a 17.078 s transfer floor at 20 Mbit/s. Lossy proxies remain unapproved. A stored legacy-audio mix preview is a separate deferred audio-preview decision, not MIDI-05. See the [OPT-05 evidence](technical-design/evidence/opt-05-audio-delivery-rollout.md).

**Acceptance gate:** Met for the non-negotiable shell, privacy, lossless-quality, warm-reuse and $0 requirements. The optimized cold playback target remains an evidence-backed exception: 17.709 s median for the controlled synthetic FLAC set, bounded by its bytes rather than a shell/decode barrier. Any lossy proxy experiment requires a separate decision.

## Roadmap interruption M — MIDI-first MVP expansion

**Status:** Complete — MIDI-01–MIDI-07 are implemented; source admission remains enabled

**Delivered in MIDI-02:** Expand-only owner-scoped MIDI stem identities, conflict-safe mutable drafts, immutable-version schema foundations, private preset allowlist validation, exact read-only RLS/Data API grants, idempotent blank/import/derive draft creation, canonical bounded note saves, My stems navigation/library states, and a lazy standalone editor shell with basic accessible note controls and deterministic sample-free playback. Project manifests still cannot reference drafts or “latest” pointers; piano-roll editing begins in MIDI-03 and immutable stem publication remains in MIDI-04.

**Delivered in MIDI-03:** A viewport-rendered, Signal-derived piano roll now translates note creation, selection, move, resize, duplicate, delete, velocity, and explicit quantize into Jam-owned semantic commands. The synchronized native note list/inspector and scoped keyboard shortcuts provide equivalent non-pointer editing; command history is bounded to 100 undo/redo snapshots and is never persisted. Draft commands debounce into the existing optimistic save RPC with offline/error/conflict states, automatic online retry, and validated private local recovery. The visible playhead, zoom/grid controls, preset-range guards, 2,048-note fixture coverage, and bounded payload evidence complete standalone composition editing without persisting canvas or Signal runtime state. Immutable publication, recording, and MIDI interchange remain MIDI-04.

**Delivered in MIDI-04:** The standalone editor now records one undoable raw-timing take from an accessible on-screen piano, A–K QWERTY mapping, or optional gesture-gated Web MIDI input, with octave/default velocity, count-in, metronome, playhead, and safe release on stop, focus loss, audio suspension, disconnect, or disposal. Conflict-safe publication appends an exact immutable version with checksum, creator credit snapshot, version number, and optional derivation lineage under owner RLS and the 500-version prototype cap. Bounded browser-only Standard MIDI import reports ignored/merged metadata before saving a new private draft; My stems auditions exact versions and creates deterministic attributed `.mid` downloads without Storage bytes.

**Delivered in MIDI-05:** New projects atomically create owner membership and an empty MIDI-capable manifest-v2 workspace while existing projects remain `legacy_hybrid`. The current nested Studio route uses the route-neutral authorized resolver and a lazy composite surface for exact immutable-version import/replacement, arrangement/mixer controls, synchronized legacy-audio/MIDI playback, optimistic save, idempotent immutable publication, multi-track `.mid` export, and browser-local WAV rendering. Normalized workspace/revision clips and MIDI creator snapshots validate against the canonical manifest; anonymous current-revision preview exposes only referenced MIDI notes and preset versions, requests no Storage source for MIDI-only revisions, and signs only already-authorized legacy audio in mixed revisions. History and public project presentation distinguish MIDI presets while every v1 audio path remains supported.

**Delivered in MIDI-06:** Contribution workspaces preserve manifest-v2 audio/MIDI clips and exact immutable stem versions through save, immutable submission, review, request changes, stale-safe acceptance, and copy-on-write forks. Derived stem versions preserve parent lineage and creator credit snapshots; mixed projects reuse already-authorized audio without admitting or duplicating source bytes. Public/private contribution and fork paths retain existing project authority and exact-base semantics.

**Delivered in MIDI-07:** A private global prototype capability now gates `reserve_source_asset` before new asset/quota mutation and ships enabled. A read-only capability RPC drives unavailable upload controls and storage-sustainability copy without pricing language; database authority still blocks stale UI and old-client RPC bypasses. Valid pre-lock reservations retain idempotent completion/verification/cancellation/expiry, and disabled-mode database/browser coverage preserves mixed legacy-audio contribution behavior. The [transition runbook](runbooks/source-admission-transition.md) records future STUDIO-06 enablement, 24-hour grace, rollback, and PR 18 capacity/history handoff. MIDI-07 adds one private row and no Storage bytes; normal uploads-page preflight adds one bounded boolean read.

**Outcome:** MIDI supplies the prototype's low-storage creation and collaboration foundation: deterministic synth tracks, accessible piano-roll editing/recording, immutable publication/contributions/forks, previews, and `.mid` export. MIDI-07 prepares reversible source-admission enforcement, but the lock remains off until the Studio-native creation and arrangement path reaches parity in STUDIO-06.

**Slices:** `MIDI-01` format/session/engine feasibility gate; `MIDI-02` standalone stem foundation; `MIDI-03` Signal-derived piano roll/editing; `MIDI-04` recording, immutable stem versions, and MIDI interchange; `MIDI-05` Studio import, project publish, preview, and export; `MIDI-06` contributions/credits/forks; `MIDI-07` source-admission controls and compatibility readiness without hosted lock enablement.

**Compatibility contract:** This is not a billing implementation. New projects become MIDI-first and the source reservation authority rejects new audio after transition. Existing audio projects, workspaces, revisions, contributions, forks, credits, playback, downloads, and exports remain private, supported, and immutable; no history is converted or deleted.

**Acceptance gate:** The MIDI domain/runtime/collaboration path works without uploaded audio; disabled-mode tests prove old clients cannot bypass source-admission authority; existing audio regressions pass; the capability remains enabled until the integrated Studio journey satisfies the later parity gate.

## Roadmap program S — Studio-forward workspace

**Status:** Repository complete — STUDIO-01–STUDIO-06 are implemented; hosted evidence acceptance and the separately authorized audio-lock transition remain before PR 18

**Outcome:** Jam Session Studio becomes the primary authenticated music-making workspace where users create, open, close, and safely switch one authorized project; arrange audio and MIDI on one timeline; and compose or record MIDI in project context. Projects/workspaces and immutable stem versions remain authority while the editor/audio runtime stays lazy, client-only, and disposable.

**Pre-MIDI decisions now fixed:** `/studio` is the start center; `/studio/{projectId}` is the canonical selected-project route; the current nested route redirects compatibly; the initial shell opens the start center rather than an implicit last project; one live project is sufficient; manifest v2 uses stable audio and MIDI clip identities; and DSP speed/pitch work is not on the MVP critical path. MIDI-01 freezes route-neutral session/adapter contracts, while MIDI-05 supplies the composite runtime, normalized clip foundations, and atomic project-plus-empty-workspace command.

### STUDIO-01 — Canonical shell and route migration

**Outcome:** The authenticated `/studio` start center loads without editor/audio code, and every existing Studio link reaches a canonical, independently authorized `/studio/{projectId}` session.

**Delivered:** The lightweight persistent shell and start center are authenticated without importing the editor runtime; selected routes reuse the route-neutral resolver and remount by authorized session authority; project actions and CTAs use the canonical URL; and the nested route is redirect-only.

### STUDIO-02 — Project browser, safe switching, and Studio-owned creation

**Outcome:** Users can create, open, close, and serially switch authorized projects from Studio without losing an acknowledged draft or leaking runtime state between sessions.

**Delivered:** The persistent shell provides a bounded cursor-backed authorized project browser and shared project-creation dialog; `/projects/new` and Studio reuse the same validation/action/RPC contract. Selected audio and MIDI sessions register a minimal generation-aware save, recovery, and disposal port so clean, dirty, saving, offline/error, conflict, and source-loading exits coordinate before canonical navigation and route reauthorization.

### STUDIO-03 — Unified arranger layout and visualization

**Outcome:** The form-like composite surface becomes one coherent arranger with aligned channel headers, shared ruler/playhead/transport, audio waveform lanes, MIDI note-summary lanes, selection, mixer controls, and an exact-value inspector.

**Delivered:** Manifest-v2 sessions now project every stable audio and MIDI clip into one engine-neutral arranger model with deterministic tick/millisecond/pixel math. The desktop workspace provides fixed channel strips, shared ruler/playhead/zoom/follow state, persisted-then-decoded audio summaries, bounded immutable-note summaries, keyboard selection, exact-value inspection, and Studio-owned action/status regions while preserving the existing runtime and mutation commands.

### STUDIO-04 — Core arrangement interactions

**Outcome:** Pointer and keyboard users can reorder or duplicate tracks and move, copy/paste, trim, loop, delete, and undo/redo clips. Audio split is enabled only after manifest-v2 projections survive save/publish/submit/accept/fork exactly.

**Delivered:** A deterministic validated command/history layer now drives pointer drag, keyboard, snap/no-snap, and exact inspector edits. MIDI tracks duplicate into new lanes with fresh stable IDs; MIDI clips support source trim, duration, loop, copy/paste/delete and selected-clip-only version replacement. Audio clips support bounded move/trim/split inside their immutable asset track. Semantic edits feed debounced conflict-safe workspace saves and local recovery, while adapter and pgTAP fixtures prove every secondary MIDI/audio clip survives publication, contribution acceptance, and fork projections.

### STUDIO-05 — Integrated MIDI composition and recording

**Outcome:** Users open the shared piano roll inside Studio, create or derive a private stem draft, draw or record against project transport, then explicitly freeze a new immutable version and atomically add or replace the selected arrangement clip. My stems and standalone editor routes remain supported alternate/library surfaces.

**Delivered:** The shared piano-roll/recorder opens in project context from the inline pending MIDI lane, clip Enter/double-click, and the inspector. Blank, local `.mid`, and exact-version-derived drafts retain separate autosave/recovery while project tempo, meter, transport, count-in, metronome, pointer/QWERTY, and gesture-gated Web MIDI remain available. One replay-safe database command freezes the acknowledged draft and applies either a new track/clip or one selected replacement in the workspace transaction; stale locks, changed retries, unrelated actors, and failed projections roll back without orphan versions. Publish stays disabled while an integrated draft is open, source admission remains enabled, and standalone My stems remains supported.

### STUDIO-06 — Parity, hardening, and audio-lock enablement

**Outcome:** Route/deep-link compatibility, session and MIDI-draft disposal, signed-source refresh, performance, accessibility, browser behavior, collaboration, exports, and legacy regressions pass. Only then is new source admission disabled at database authority with a rehearsed rollback.

**Delivered:** The broad local journey covers Studio-owned creation, integrated MIDI composition/recording, arrangement/mix persistence, publication/preview/export, contributions, acceptance, and forks. Exact referenced MIDI versions now load for read-only revision and contribution surfaces, alternate Studio surfaces no longer require the canonical shell provider, repeated switching proves one live workspace, and stale clients rely on the atomic reservation RPC for authoritative lock denial. The 8-track/2,000-note benchmark and disabled-mode transition are recorded in the [STUDIO-06 evidence](technical-design/evidence/studio-06-parity-hardening.md). Hosted admission remains enabled pending separate authorization.

**Deferred outside this program:** pitch shift, coupled varispeed, pitch-preserving time stretch, multiple simultaneous live projects, OpenDAW integration, plugins/effects/automation, and professional-DAW parity. These require separate evidence and product/format decisions and do not block the invited MVP.

**Acceptance gate:** `/studio` is useful without a selected project; selected routes reauthorize; acknowledged arrangement and MIDI-draft edits are preserved or explicitly recovered; only one project graph and one armed draft remain live; supported clip state is deterministic across immutable collaboration flows; a musician completes creation/recording/arranging without leaving Studio; v1 audio and standalone MIDI routes remain compatible; and the audio lock is enabled only after this evidence is accepted.

## Roadmap program U — Studio and MIDI usability

**Status:** Complete — UX-01 through UX-05 implemented and milestone pulse accepted

**Outcome:** Iterate on the merged Studio with musician feedback before inviting users: playback remains synchronized through live mixer changes, project and track workflows follow familiar DAW conventions, MIDI keys respond like an instrument, and clips/notes can be arranged spatially without changing manifest-v2 or immutable collaboration semantics.

**Slices:** `UX-01` transport, live mixer, drag, and continuous timeline correctness; `UX-02` DAW shell and blank Studio; `UX-03` inline track creation and track-as-container workflow; `UX-04` piano feel, labels, initial viewport, active-note feedback, and pointer glissando; `UX-05` marquee selection and block editing.

**Delivered through UX-05:** Playback now follows one browser-audio clock through live mixer changes, continuous seeking, and clip drag completion. `/studio` renders a runtime-free blank workstation with a compact File menu. Selected sessions keep an in-context Add a track row, session-only named pending lanes, direct blank/imported piano-roll drafts, atomic immutable finalization with focus return, same-track multi-clip copy/paste, full MIDI-track duplication, freely spaced non-overlapping clips, and compatible two-axis MIDI move/copy while exact version and credit lineage remain authoritative. The shared editor adds layered semantic piano keys, C-only melodic and mapped-drum labels, a one-time clamped middle-C viewport, source-aware held-note feedback across pointer/QWERTY/Web MIDI/previews, and gutter/performance-key pointer glissando with complete release cleanup. Explicit Pencil and Select tools now add tick/pitch marquee selection, Shift toggling, snapped or Alt-free block movement, grabbed-note audition, one-step copy-drag, deterministic keyboard copy/paste, and single-step undo/redo while the note list remains the accessible selection authority.

**Milestone pulse:** Accepted on 2026-07-15. Unit/component coverage, the bounded 2,048-note/128-selection fixture, established Chromium Studio coverage, immutable round-trip coverage, and the production build support moving past the repository interruption. Perceptual mixer smoothness/latency, hardware Web MIDI, screen-reader narration, extended browser coverage, and hosted delivery remain the already recorded manual/release matrix. UX-01 did not add a separate development drift logger or perceptual late-note threshold; its single audio-clock contract removes the independent drift source structurally, while long-session/perceptual measurement remains PR 19 hardening rather than a blocker to PR 18.

**Implementation authority:** The detailed slice plan is intentionally local at `local/implementation-plans/023-studio-midi-usability-pass.md`. Tracked architecture, design, evidence, and this roadmap are updated as each behavior lands. Signal is an MIT-licensed interaction reference pinned in the plan and existing third-party notice; Jam Session retains its own state, persistence, authorization, collaboration, styling, and browser-runtime boundaries.

**Acceptance gate:** The five slices pass their focused checks and one final milestone pulse check records remaining accepted limitations. The hosted STUDIO-06 capability review then records the final source-admission state before PR 18 begins.

### PR 18 — Moderation, retention, quotas, and storage operations

**Status:** Pending operational handoff — record the deployed hosted parity review and final source-admission capability state before implementation

**Outcome:** The invited demo can be operated safely within Supabase Free limits using manual reports and deterministic cleanup that cannot break surviving history.

**Planned scope:**

- private moderation reports/actions and legal/abuse holds with administrator-only detail and commands;
- report actions for profiles, projects, and contributions plus reporter-safe status;
- a bounded manual administrator queue and explicit hide/restore/suspend/reject operations;
- actual Storage usage by bucket, a 750 MiB administrator warning, and conservative 850 MiB admission enforcement;
- dry-run-first cleanup for incomplete uploads (24 hours), abandoned workspaces and recoverable deletion (30 days), and eligible moderation/audit metadata (180 days);
- centralized reference/hold checks covering audio/MIDI revisions, workspaces, contribution versions, forks, avatars, derived peaks, any separately implemented previews, and processing jobs;
- separate database-growth reporting for MIDI relational data and Storage reporting for retained legacy audio/derived objects, while explaining the authoritative source-admission state and transition history;
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
- `OPT-01`–`OPT-05` complete before `MIDI-01`; `MIDI-01`–`MIDI-07` complete before `STUDIO-01`; `STUDIO-01`–`STUDIO-06` complete before `UX-01`; `UX-01`–`UX-05` and the recorded hosted capability handoff complete before PR 18.
- MIDI-01 owns the route-neutral session/adapter and manifest-v2 clip contracts; MIDI-05 owns the composite runtime, normalized clip foundations, and atomic empty-workspace creation required by the later Studio slices.
- MIDI-07 installs/tests the source-admission capability while leaving it enabled. STUDIO-06 provides the repository parity evidence; an authorized hosted review and separately approved mutation determine and record the final capability state. Source reservation authority, not hidden controls, enforces any lock.
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
| Future storage solution and any audio-access model                | Post-MVP               | No billing schema; global new-audio admission is disabled only after STUDIO-06 parity      |

## Definition of MVP complete

The invited MVP is complete only when:

1. An invited user can authenticate, onboard, and manage a safe public profile.
2. A creator can record/edit MIDI tracks and arrange/mix them on the shared Studio timeline without leaving Studio, publish immutable revisions, preview them, reopen a workspace, and export standard MIDI; existing audio creators retain authorized playback/download/export access.
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
