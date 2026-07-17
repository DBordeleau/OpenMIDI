# Architecture Decision Records

ADRs preserve decisions that coding agents must not silently revisit. A changed decision requires a superseding ADR, not an unannounced implementation deviation.

## Decision status

ADR-001 through ADR-005 retain the platform, client-only runtime, immutable-history, portable-manifest, and copy-on-write foundations. ADR-006 through ADR-009 are historical/superseded where they describe Waveform Playlist, manifest v1/v2, uploaded musical media, source admission, or the old OPT/MIDI/STUDIO sequence. ADR-010 through ADR-014 are the current MIDI-only authority and are implemented through PIVOT-09. PIVOT-10 hosted rehearsal remains unapproved.

## Accepted for initial implementation

### ADR-001: Next.js application with a client-only studio boundary

- **Decision:** Use Next.js App Router for the product and a dynamically loaded client-only studio feature.
- **Why:** Public/social pages benefit from server rendering while Web Audio and the MIDI editor/runtime require browser APIs.
- **Consequence:** No browser editor, Tone.js, or Web Audio import may enter a Server Component or shared server module.

### ADR-002: Supabase as identity, relational authority and bounded object storage

- **Decision:** Use Supabase Auth and Postgres, with Storage retained only for the approved private-original/public-derived avatar boundary in the MIDI-only target. Apply RLS to all exposed public-schema tables.
- **Why:** It matches the MVP needs and avoids a bespoke service tier.
- **Consequence:** Service-role access is exceptional; ordinary workflows remain user-scoped and policy-tested.

### ADR-003: Immutable revisions with mutable private workspaces

- **Decision:** Published work and submitted contributions are immutable snapshots; autosave targets private workspace drafts.
- **Why:** Reliable attribution, forks, review and recovery require stable history.
- **Consequence:** Acceptance creates a revision rather than updating one.

### ADR-004: Jam Session manifest is the portable workspace authority

> Superseded for the MIDI-only target by ADR-011. This remains the historical authority for manifest v1/v2 behavior until the pivot cutover removes it.

- **Decision:** Persist a versioned Jam Session JSON manifest and normalized track projection; do not require an opaque editor-native snapshot for MVP reopen.
- **Why:** The MVP collaboration subset is small enough to model directly, making it server-validatable, migration-friendly, and independent of a particular editor.
- **Consequence:** The Waveform Playlist adapter must deterministically hydrate from and export to the manifest, and publish validates every referenced asset.

### ADR-005: Copy-on-write forks and no automatic musical merge

> Asset-specific wording is superseded by ADR-010/ADR-011. Copy-on-write immutable references and stale-base contribution semantics remain accepted.

- **Decision:** Forks reference immutable arrangement/pattern versions; contribution acceptance requires the expected base revision.
- **Why:** Duplicating immutable content wastes resources, and a Git-like automatic merge is unsafe for musical arrangements.
- **Consequence:** An outdated contribution needs manual rebase/resubmission in MVP.

### ADR-006: Waveform Playlist for the MVP browser studio

> Superseded by ADR-010 and ADR-012. Retained only as historical evidence; PIVOT-07 removed the dependency and adapter.

- **Decision:** Use pinned Waveform Playlist packages behind `WaveformPlaylistStudioAdapter`; retain Tone.js only where required by the selected playback/export path.
- **Why:** It supplies the MVP's multitrack timeline, synchronized playback, mixer and export capabilities through modular React/TypeScript packages under the MIT license.
- **Consequence:** Jam Session owns serialization, product-specific controls, accessibility integration and manifest migrations. OpenDAW remains a post-MVP alternative and cannot be introduced without superseding this ADR.

### ADR-007: MIDI-first prototype with dormant new-audio admission

> Superseded by ADR-010 through ADR-014. Retained as historical context for the completed MIDI-first interruption.

- **Decision:** After the $0 audio-optimization pass, add a standalone owner-scoped MIDI-stem editor/library and a project path that references exact immutable stem versions, using deterministic bundled Tone.js synthesis behind a Jam Session-owned composite client-only adapter. When the complete MIDI creation/collaboration parity gate passes, disable new `source_audio` reservation globally for the prototype without adding billing or entitlements.
- **Why:** MIDI notes and synth parameters are small enough for the $0 prototype budget and support meaningful browser-native composition, recording, revision, contribution and fork workflows without requiring uploaded media for every new project.
- **Consequence:** Manifest v1 and all existing audio history remain supported and immutable. Manifest v2 adds discriminated audio/MIDI tracks, stable clips, exact immutable MIDI-stem-version references, and immutable preset versions; canonical notes live in bounded stem drafts/versions rather than being duplicated into every project clip. Existing projects may retain legacy audio and add MIDI, but new source bytes are rejected at reservation authority after transition. Hardware Web MIDI is optional; manual piano-roll/on-screen/keyboard input is required. Sample libraries, payments and arbitrary user synth graphs remain out of scope.
- **Validation:** The MIDI expansion must prove deterministic save/reload/playback, accessible editing/recording, immutable publish/contribution/accept/fork behavior, bounded public preview and `.mid` export before the audio-admission capability is disabled. Legacy audio playback/download/export/publish regressions and old-client admission-bypass tests must pass.

### ADR-008: Studio-first shell with route-neutral sessions and manifest-v2 clips

> Manifest-v2/composite sequencing is superseded by ADR-010 through ADR-012. The canonical Studio routes and one-live-project session decision remain accepted.

- **Decision:** Make `/studio` the authenticated start center and `/studio/{projectId}` the canonical selected-project route, with the current nested route retained as a compatibility redirect. Studio is an application/session shell, not a persisted entity. Define a route-neutral authorized session descriptor and one live project editor at a time. Manifest v2 gives both MIDI and audio tracks stable clip identities; a v1 audio track maps deterministically to one v2 audio clip.
- **Why:** MIDI integration should not hard-code the current project-owned route or one-region audio projection, and a persistent Studio shell makes project creation/switching coherent without weakening project/workspace authority.
- **Consequence:** MIDI-01 freezes the descriptor, adapter capability, identity, and clip contracts; MIDI-05 implements the composite runtime, normalized clip foundations, and atomic project-plus-empty-workspace command. The delivered route/UI work follows MIDI-07 through STUDIO-01–STUDIO-06 and UX-01–UX-05 before PR 18. Existing v1 revisions are never rewritten, only one source asset may back an initial audio track, and splitting is unavailable until normalized clip round trips are proven.
- **Validation:** Empty Studio loads no editor/audio runtime; every selected route reauthorizes independently; switching preserves or explicitly recovers unsaved work; v1/v2 fixtures round-trip; clip state survives save/publish/submit/accept/fork; legacy audio and MIDI journeys remain intact.

### ADR-009: Studio-integrated MIDI creation, arranging, and deferred audio lock

> Audio compatibility and admission sequencing are superseded by ADR-010. Studio-integrated MIDI creation remains accepted and is carried into the pivot.

- **Decision:** The integrated Studio is the primary MIDI creation and arrangement experience. Musicians create, draw, record, edit, mix, and arrange MIDI without leaving the selected Studio session. The existing standalone editor and My stems routes remain supported as a reusable library, direct deep link, and accessible fallback, but they are not the final primary workflow. The Studio program expands to six slices: shell/routes, project switching/creation, unified arranger layout, clip interactions, integrated MIDI composition/recording, and final parity/hardening. MIDI-07 installs and proves the reversible source-admission capability while leaving admission enabled; STUDIO-06 enables it only after the Studio-native parity gate passes.
- **Why:** MIDI-01–MIDI-06 proved the persisted format and collaboration graph, but the shipped composite surface exposes arrangement fields as form controls rather than a credible music-making workflow. Declaring MIDI parity before musicians can manipulate tracks and clips on a shared timeline or record in project context would leave the prototype without a usable primary creation path when audio admission is disabled.
- **Consequence:** Studio reuses the Jam-owned Signal-derived piano-roll commands, recorder, accessibility inspector, and client-only Tone boundary rather than building a second editor. Audio lanes render authorized waveform peaks; MIDI lanes render note-density/piano-roll summaries. Track headers expose compact gain, pan, mute, solo, preset, readiness, reorder, and MIDI-track duplication controls. Clips support bounded selection, free non-overlapping move, copy/paste, trim, loop, and session undo/redo. Editing a referenced MIDI version creates or resumes a private draft; an explicit command freezes a new immutable version and atomically adds or replaces the selected workspace clip. Mutable draft IDs never enter project manifests, revisions, submissions, or forks, and draft autosave never silently changes an arrangement.
- **Validation:** A new user creates a project in Studio, creates or derives a MIDI part, draws and records notes against project transport, freezes the part, arranges multiple clips on the shared timeline, mixes, saves/reloads, publishes, previews, contributes, accepts, forks, and exports without navigating to a separate editor route. Pointer and keyboard paths produce the same canonical state; audio/MIDI clip state survives immutable round trips; standalone routes still work; old clients cannot bypass the disabled source capability; and existing legacy audio remains private and usable.

### ADR-010: MIDI-only product and removal of source-audio compatibility

- **Status:** Accepted 2026-07-16.
- **Decision:** Jam Session's target MVP accepts, stores, versions, previews, and collaborates on structured MIDI only. Remove uploaded source audio, legacy-audio compatibility, Waveform Playlist, source verification/admission, waveform peaks, audio quotas/retention, and server-stored audio previews through PIVOT-04–PIVOT-09. Retain browser-only synthesized playback/local audio export and profile-avatar Storage.
- **Why:** Repeated full-quality source retrieval exhausted an unsustainable share of the $0 prototype egress budget, while structured MIDI supports the newly accepted public creation/remix/challenge product more directly.
- **Consequence:** The staged cutover is complete locally through PIVOT-09. No existing hosted application data must be retained. Historical audio evidence stays in Git/docs but is not current product authority. Any future uploaded-audio support requires a new PRD, cost model, and superseding ADR.
- **Validation:** The clean baseline/new hosted project has no source-audio route, bucket, function, cron, quota, schema, dependency, fixture, or product promise; MIDI creation/collaboration remains complete.

### ADR-011: Manifest v3 with patterns and shared immutable arrangement versions

- **Status:** Accepted 2026-07-16.
- **Decision:** Adopt the exact vocabulary and authority model in [`../midi-only-pivot-contract.md`](../midi-only-pivot-contract.md). Mutable workspaces contain MIDI tracks/clips. Immutable reusable note content lives in pattern versions/notes. Project revisions and contribution versions point to one shared immutable arrangement-version shape. Normalized rows are queryable authority and an immutable validated manifest v3/hash is the portable round-trip snapshot.
- **Why:** The current audio/MIDI unions, “stem” vocabulary, and duplicate revision/contribution projections encode migration history rather than the new domain. A shared immutable arrangement boundary supports deterministic semantic diffs, previews, forks, contributions, future challenges, and public pattern reuse.
- **Consequence:** PIVOT-01, PIVOT-02, and PIVOT-03 implement separate parts of one frozen contract. Existing immutable wrappers and collaboration semantics remain; target track-credit duplication is replaced by pattern creator snapshots/lineage plus revision attribution.
- **Validation:** Manifest/normalized round trips are exact; project and contribution snapshots use the same arrangement structure; semantic diff fixtures cover metadata, tracks, clips, patterns, and notes; RLS actor matrices pass.

### ADR-012: Versioned sample-free synthesized instrument catalog

- **Status:** Accepted 2026-07-16.
- **Decision:** Expand to approximately 20–24 curated versioned Tone.js synthesis presets across six instrument families. Published arrangements pin exact preset versions. No preset downloads samples, soundfonts, remote audio, or user-supplied synth graphs.
- **Why:** A broader palette is essential for a MIDI-only creative product, but sample libraries would recreate media transfer, licensing, and deterministic playback problems.
- **Consequence:** Preset versions expose stable ID/version/family/range/polyphony/engine metadata and are superseded rather than mutated. General MIDI imports map deterministically to the closest supported family without promising full timbre parity.
- **Validation:** Structural scheduling/disposal/import/local-render tests pass, bundles contain no remote sample dependency, and an optional manual listening matrix approves the curated palette.

### ADR-013: CC BY 4.0 for initial public reusable MIDI

- **Status:** Accepted 2026-07-16.
- **Decision:** Public remixable projects/patterns initially use Creative Commons Attribution 4.0 International (`CC-BY-4.0`) with exact license URL/version and explicit publish-time rights attestation. Private drafts grant no public reuse rights.
- **Why:** CC BY permits sharing, adaptation, and commercial use while requiring attribution, matching Jam Session's automatic lineage/credit product. One license avoids an MVP compatibility matrix and custom legal terms.
- **Consequence:** Required creator/source/license/change attribution cannot be removed. MIDI downloads include attribution/license material outside the `.mid` payload. Other licenses, payments, and rights-dispute resolution are deferred; public terms still require legal review before unrestricted launch.
- **Validation:** Copy-on-write reuse preserves exact source/creator/license snapshots through publish, contribution, fork, export, profile rename, and deletion.

### ADR-014: Same Git repository, clean migration baseline, and fresh hosted Supabase project

- **Status:** Accepted 2026-07-16.
- **Decision:** Refactor this repository on `midi-only-pivot`, preserve pre-pivot history, replace the historical migration chain with a reviewed MIDI-only baseline after cutover, and rehearse against a new hosted Supabase project. Do not migrate existing application/Auth/Storage data.
- **Why:** Identity, Studio, collaboration, moderation, design, and testing work are worth retaining, while a fresh backend avoids stale audio objects, cron, secrets, Edge Functions, Auth data, and migration history.
- **Consequence:** Implementation uses local Supabase only until PIVOT-10 receives explicit approval. The old hosted project remains untouched during implementation and is deleted only after the new environment is accepted separately.
- **Validation:** A clean local reset and fresh hosted project reproduce the same types/RLS/behavior; the new project contains only Auth/Postgres plus approved avatar Storage/processing; no audio infrastructure exists.

## ADR template

```md
# ADR-NNN: Short decision title

Status: Proposed | Accepted | Superseded
Date: YYYY-MM-DD
Owners: names/roles

## Context

What forces the decision?

## Decision

What are we doing?

## Alternatives considered

What credible options were rejected and why?

## Consequences

What becomes easier, harder, required or prohibited?

## Validation

What evidence will confirm the decision remains sound?
```
