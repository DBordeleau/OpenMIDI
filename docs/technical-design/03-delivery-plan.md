# Delivery Plan and Engineering Contract

Status: Accepted; repository implemented and pulse-checked through PR 17, OPT-05, MIDI-07, STUDIO-06, and UX-05; hosted capability review remains before M6/PR 18

## Delivery strategy

Build thin vertical slices that end in observable user behavior. A focused Waveform Playlist integration spike precedes project persistence so the adapter, manifest round trip, browser behavior and bundle cost are proven early.

## Milestones

M0–M5 and M5.5–M5.8 are repository-complete. Source credits require explicit confirmation, immutable history preserves attribution and fork lineage without duplicating source audio, and owner-controlled public projects flow through a safe catalog with bounded search, public history, and metadata-only presentation. Source audio remains private and participant-scoped. Before M6, complete the hosted capability handoff, PR 18 moderation/retention operations, and the remaining roadmap hardening. Conditional manual browser/audio/MIDI/preview checks remain recorded as such.

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
- Owner review with A/B metadata and accept/reject/request-changes. **Implemented in PR 13 with exact-version private audition and immutable review history.**
- Atomic accept creates a project revision; outdated base is surfaced. **Implemented in PR 13 with idempotent acceptance and `base_outdated` changes-requested fallback.**
- Immutable ordered musical credits, confirmed asset attribution, distinct publisher/accepted-contributor snapshots, rename/deletion stability, and profile history. **Implemented in PR 14.**

Exit: a second account can contribute a stem and the owner can accept it without mutating prior history.

### M5 — Forking and discovery

- Copy-on-write fork with complete lineage and license checks. **Implemented in PR 15.**
- Browse/search filters for genre, tags, BPM, key and instrument. **Implemented in PR 16.**
- Recent and explainable trending ordering. **Implemented in PR 16.**
- Paginated public profile project/contribution lists, bounded dashboard/private indexes, trusted avatars, throttled activity, and complete responsive navigation. **Implemented in PR 17.**

Exit: **Met in PR 17** — fork lineage/discovery respect visibility/RLS, and profile/private work is efficiently navigable.

### M5.5 — $0 audio-delivery optimization

- Instrument controlled cold/warm studio timing and bytes. **Implemented in OPT-01; baseline evidence records 29.352 s cold and 29.336 s same-session median readiness for the controlled uncompressed path.**
- Render the arrangement shell and safe controls before complete source decoding. **Implemented in OPT-02; the controlled cold profile records a 7 ms median and 48 ms slowest harness shell mark.**
- Progressively attach tracks with honest per-track/playback readiness and bounded in-session reuse. **Implemented in OPT-02 with isolated retry/cancellation, audible-track playback gating, and a 12-entry/384 MiB actor-scoped LRU.**
- Add capable-browser lossless WAV-to-FLAC preprocessing. **Implemented in OPT-03 with a lazy dedicated worker, progress/cancellation/fallback, same-PCM transient peaks, exact passthrough for FLAC/MP3, and canonical-FLAC verification. OPT-04 now persists those private peaks separately.**
- Persist private browser-generated peaks without changing source authority. **Implemented in OPT-04 with compact source-bound `JSPK` v1 objects, direct owner upload, server-side byte validation, RLS/Storage actor coverage, global derived-capacity accounting, signed descriptors, and peaks-first adapter hydration with safe fallback.**
- Preserve private source authority, exact export/download behavior, and a no-paid-worker architecture.

OPT-01 selected pinned `mediabunny@1.50.8` + `@mediabunny/flac-encoder@1.50.8` after Chromium/Firefox round-trip, cancellation, peak-generation, and near-limit capability checks. OPT-03 installs those exact packages only in the lazy upload-worker graph and retains capability/failure fallback; Safari/macOS and measured peak memory remain manual release evidence. See [`evidence/opt-01-audio-delivery-baseline.md`](evidence/opt-01-audio-delivery-baseline.md) and [`evidence/opt-03-browser-lossless-upload.md`](evidence/opt-03-browser-lossless-upload.md).

OPT-02 leaves source bytes, Storage/RLS, signed-URL authorization, manifests, and publication transactions unchanged. Its controlled WAV playback remains about 29.4 seconds cold because this slice does not transcode; after one unmeasured same-session prime, all five measured warm runs reuse decoded buffers without transfer or decode. See [`evidence/opt-02-progressive-studio.md`](evidence/opt-02-progressive-studio.md).

OPT-04 leaves source verification, immutable history, manifest v1 and existing assets unchanged. Its fixed 2,048-bin peak object is a disposable initial waveform only; canonical audio decode replaces it for detailed zoom. See [`evidence/opt-04-persisted-waveform-peaks.md`](evidence/opt-04-persisted-waveform-peaks.md).

OPT-05 completes M5.5. The controlled browser-generated FLAC set retains 59.76% of the synthetic WAV bytes, improves five-run median cold playback from 29.267 s to 17.709 s, and keeps median shell readiness at 5 ms; primed same-session reuse remains transfer-free and ready in under 5 ms. Full browser-decoded PCM equality passed for every controlled, stress and boundary sample. The 8–12 s cold target is not met because the controlled FLAC bytes alone require 17.078 s at 20 Mbit/s. No lossy proxy or stored audio mix preview is introduced. The latter remains a separate future legacy-audio delivery decision rather than MIDI-05 scope. See [`evidence/opt-05-audio-delivery-rollout.md`](evidence/opt-05-audio-delivery-rollout.md).

Exit: **Met with a documented cold-playback exception** — the controlled cold studio shell is usable within two seconds, warm playback is immediate after the session prime, lossless/private behavior is unchanged, and the remaining cold delay is quantified as network-bound for the MIDI compatibility handoff.

### M5.6 — MIDI-first MVP expansion

Status: Complete through MIDI-07; source admission remains enabled.

- In MIDI-01, freeze the route-neutral Studio session/capability contract plus manifest v2 with stable audio/MIDI clips; preserve deterministic v1-to-v2 mapping.
- Add a standalone, accessible MIDI-stem editor and immutable reusable stem versions before project integration.
- Add deterministic versioned Tone.js synth/drum presets without hosted samples.
- Add accessible piano-roll/clip editing, on-screen/QWERTY recording, and optional permission-gated hardware Web MIDI.
- In MIDI-05, add the composite runtime, normalized clip foundations, atomic MIDI project-plus-empty-workspace creation, and extend immutable workspace/publish/preview/export paths.
- MIDI-06 extends contribution workspaces, immutable submission/review/acceptance, creator and derivation credit snapshots, mixed-project compatibility, and copy-on-write forks to exact MIDI stem versions.
- In MIDI-07, add the trusted source-admission capability and disabled-mode bypass tests, but leave admission enabled until the Studio-native parity gate.
- Preserve every existing audio project, reference, private access path, download/export and immutable snapshot.

Exit: the MIDI format, standalone editor foundation, immutable collaboration graph, and reversible source-admission control are complete; admission remains enabled; legacy audio regressions pass; the accepted Studio contracts and data foundations are ready for M5.7.

### M5.7 — Studio-forward workspace

- `STUDIO-01` (complete): add `/studio` start center and canonical `/studio/{projectId}` route using the route-neutral authorized session resolver; retain the nested route as a compatibility redirect.
- `STUDIO-02` (complete): add the bounded project browser, safe serial switching, and Studio-owned project creation using the atomic command introduced with MIDI.
- `STUDIO-03` (complete): replace the form-like composite surface with one coherent arranger shell: shared ruler/playhead, audio waveform lanes, MIDI note-summary lanes, channel headers, mixer controls, selection, inspector, and transport.
- `STUDIO-04` (complete): add accessible reorder, clip move, duplicate/copy/paste, trim, loop, snap, and session undo/redo; enable audio split only after exact v2 projection round trips pass.
- `STUDIO-05` (complete): integrate the existing piano roll and recorder into Studio so users create/derive drafts, compose or record against project transport, then explicitly freeze a version and atomically add or replace the selected clip without putting draft IDs in manifests.
- `STUDIO-06` (repository complete): harden routes, deep links, session/draft disposal, performance, alternate read-only surfaces, collaboration regressions, and stale-client admission authority; hosted evidence acceptance and lock enablement remain separate operations.
- Keep pitch shift, varispeed, pitch-preserving time stretch, OpenDAW, multiple simultaneous live projects, and professional-DAW parity outside the MVP critical path.

Repository exit: Studio is the primary project-independent MIDI creation and arrangement workspace; authorized users can create, record, edit, arrange, mix, open, close, and safely switch one live project without losing acknowledged work; and supported state survives immutable collaboration flows. Operational exit: the deployed parity result and final source-admission capability state are reviewed and recorded before PR 18 covers the final MIDI/audio reference graph.

### M5.8 — Studio and MIDI usability

Status: Complete; milestone pulse accepted.

- `UX-01` makes the browser audio clock authoritative for transport/playhead state, keeps mixer changes live, and repairs continuous seek and clip drag completion.
- `UX-02` presents `/studio` as a runtime-free blank workstation with familiar File lifecycle actions.
- `UX-03` adds session-only pending MIDI lanes, direct compose/import, atomic track materialization, multi-clip containers, track duplication, and compatible cross-track movement.
- `UX-04` improves piano depth, C/mapped labels, initial middle-C position, active-note feedback, and pointer glissando.
- `UX-05` adds explicit Pencil/Select tools, marquee selection, semantic block move/copy, grabbed-note audition, and one-step history.

Repository exit: the usability requirements are implemented without a manifest, schema, authorization, immutable-history, or hosted source-admission change. Perceptual audio, hardware MIDI, screen-reader, extended-browser, and long-session drift measurements remain conditional/manual release evidence and PR 19 hardening.

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
- Manifest v2 canonicalization/migration, tick-time conversion, synth preset versioning, MIDI editor commands, quantize/undo/redo, and Standard MIDI File mapping.
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
- MIDI workspace/revision/contribution projections match the canonical manifest, remain RLS-scoped and immutable where required, and never increment source-byte quotas.
- Disabled source admission rejects before asset or quota mutation while existing source references remain valid.

### Browser/E2E

- OAuth callback can be supplemented by a test-only login path; production auth remains covered by an integration smoke test.
- Upload, synchronized playback, save/reload, submit, review, accept and fork.
- Expired signed URL refresh during a long studio session.
- Network interruption and resume during upload/autosave.
- Web Audio permission/suspension recovery and unsupported-browser messaging.
- MIDI piano-roll/record/save/reload/publish/preview/export and optional Web MIDI denied/unavailable fallback.
- Full legacy audio journey after the source-admission lock.

### Contract fixtures

Commit small, redistributable manifest, audio and MIDI fixtures for every supported manifest/adapter compatibility version. CI must hydrate the editor model and round-trip the manifest deterministically. A package upgrade or preset change is incomplete until fixtures and migration compatibility pass.

## Non-functional targets for MVP

Targets should be validated with product analytics and adjusted deliberately:

- Public pages: Core Web Vitals “good” at the 75th percentile on supported devices.
- Product shell excludes Waveform Playlist, Tone.js and browser-audio code; the studio bundle loads only on the studio route.
- MIDI preview/editor code remains lazy; public pages do not load the full studio or audio editor merely to render metadata.
- A controlled MIDI studio with 8 tracks/2,000 notes becomes playback-ready within two seconds after the explicit audio-context gesture.
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
- MIDI project/track creation, schedule construction, recording capability/permission outcome, publish/export success, manifest byte/note counts, and categorized failure without raw note payloads or device identity.
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
| MIDI format or preset drift                       | Historical playback changes  | Immutable manifest/preset versions, canonical fixtures, exact Tone pin, additive migrations                         |
| Web MIDI unavailable or denied                    | Hardware recording missing   | Complete piano-roll/on-screen/QWERTY path; permission only from explicit gesture; no SysEx                          |
| Audio lock breaks existing history                | Data loss/product regression | Enforce only new reservation, retain all readers/references, old-client bypass tests, staged enable/rollback        |
