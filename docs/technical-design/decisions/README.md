# Architecture Decision Records

ADRs preserve decisions that coding agents must not silently revisit. A changed decision requires a superseding ADR, not an unannounced implementation deviation.

## Accepted for initial implementation

### ADR-001: Next.js application with a client-only studio boundary

- **Decision:** Use Next.js App Router for the product and a dynamically loaded client-only studio feature.
- **Why:** Public/social pages benefit from server rendering while Web Audio and the waveform editor require browser APIs.
- **Consequence:** No browser editor, Tone.js, or Web Audio import may enter a Server Component or shared server module.

### ADR-002: Supabase as identity, relational authority and object storage

- **Decision:** Use Supabase Auth, Postgres and Storage with RLS on all public-schema tables.
- **Why:** It matches the MVP needs and avoids a bespoke service tier.
- **Consequence:** Service-role access is exceptional; ordinary workflows remain user-scoped and policy-tested.

### ADR-003: Immutable revisions with mutable private workspaces

- **Decision:** Published work and submitted contributions are immutable snapshots; autosave targets private workspace drafts.
- **Why:** Reliable attribution, forks, review and recovery require stable history.
- **Consequence:** Acceptance creates a revision rather than updating one.

### ADR-004: Jam Session manifest is the portable workspace authority

- **Decision:** Persist a versioned Jam Session JSON manifest and normalized track projection; do not require an opaque editor-native snapshot for MVP reopen.
- **Why:** The MVP collaboration subset is small enough to model directly, making it server-validatable, migration-friendly, and independent of a particular editor.
- **Consequence:** The Waveform Playlist adapter must deterministically hydrate from and export to the manifest, and publish validates every referenced asset.

### ADR-005: Copy-on-write forks and no automatic audio merge

- **Decision:** Forks reference immutable assets; contribution acceptance requires the expected base revision.
- **Why:** Byte duplication wastes storage, and a Git-like automatic merge is unsafe for musical arrangements.
- **Consequence:** An outdated contribution needs manual rebase/resubmission in MVP.

### ADR-006: Waveform Playlist for the MVP browser studio

- **Decision:** Use pinned Waveform Playlist packages behind `WaveformPlaylistStudioAdapter`; retain Tone.js only where required by the selected playback/export path.
- **Why:** It supplies the MVP's multitrack timeline, synchronized playback, mixer and export capabilities through modular React/TypeScript packages under the MIT license.
- **Consequence:** Jam Session owns serialization, product-specific controls, accessibility integration and manifest migrations. OpenDAW remains a post-MVP alternative and cannot be introduced without superseding this ADR.

### ADR-007: MIDI-first prototype with dormant new-audio admission

> Sequencing and primary-editor ownership are superseded by ADR-009. The immutable stem-version, composite-runtime, and global-capability decisions remain in force.

- **Decision:** After the $0 audio-optimization pass, add a standalone owner-scoped MIDI-stem editor/library and a project path that references exact immutable stem versions, using deterministic bundled Tone.js synthesis behind a Jam Session-owned composite client-only adapter. When the complete MIDI creation/collaboration parity gate passes, disable new `source_audio` reservation globally for the prototype without adding billing or entitlements.
- **Why:** MIDI notes and synth parameters are small enough for the $0 prototype budget and support meaningful browser-native composition, recording, revision, contribution and fork workflows without requiring uploaded media for every new project.
- **Consequence:** Manifest v1 and all existing audio history remain supported and immutable. Manifest v2 adds discriminated audio/MIDI tracks, stable clips, exact immutable MIDI-stem-version references, and immutable preset versions; canonical notes live in bounded stem drafts/versions rather than being duplicated into every project clip. Existing projects may retain legacy audio and add MIDI, but new source bytes are rejected at reservation authority after transition. Hardware Web MIDI is optional; manual piano-roll/on-screen/keyboard input is required. Sample libraries, payments and arbitrary user synth graphs remain out of scope.
- **Validation:** The MIDI expansion must prove deterministic save/reload/playback, accessible editing/recording, immutable publish/contribution/accept/fork behavior, bounded public preview and `.mid` export before the audio-admission capability is disabled. Legacy audio playback/download/export/publish regressions and old-client admission-bypass tests must pass.

### ADR-008: Studio-first shell with route-neutral sessions and manifest-v2 clips

> The four-slice delivery sequence is superseded by ADR-009. The route, session, manifest, and one-live-project decisions remain in force.

- **Decision:** Make `/studio` the authenticated start center and `/studio/{projectId}` the canonical selected-project route, with the current nested route retained as a compatibility redirect. Studio is an application/session shell, not a persisted entity. Define a route-neutral authorized session descriptor and one live project editor at a time. Manifest v2 gives both MIDI and audio tracks stable clip identities; a v1 audio track maps deterministically to one v2 audio clip.
- **Why:** MIDI integration should not hard-code the current project-owned route or one-region audio projection, and a persistent Studio shell makes project creation/switching coherent without weakening project/workspace authority.
- **Consequence:** MIDI-01 freezes the descriptor, adapter capability, identity, and clip contracts; MIDI-05 implements the composite runtime, normalized clip foundations, and atomic project-plus-empty-workspace command. The delivered route/UI work follows MIDI-07 through STUDIO-01–STUDIO-06 and UX-01–UX-05 before PR 18. Existing v1 revisions are never rewritten, only one source asset may back an initial audio track, and splitting is unavailable until normalized clip round trips are proven.
- **Validation:** Empty Studio loads no editor/audio runtime; every selected route reauthorizes independently; switching preserves or explicitly recovers unsaved work; v1/v2 fixtures round-trip; clip state survives save/publish/submit/accept/fork; legacy audio and MIDI journeys remain intact.

### ADR-009: Studio-integrated MIDI creation, arranging, and deferred audio lock

- **Decision:** The integrated Studio is the primary MIDI creation and arrangement experience. Musicians create, draw, record, edit, mix, and arrange MIDI without leaving the selected Studio session. The existing standalone editor and My stems routes remain supported as a reusable library, direct deep link, and accessible fallback, but they are not the final primary workflow. The Studio program expands to six slices: shell/routes, project switching/creation, unified arranger layout, clip interactions, integrated MIDI composition/recording, and final parity/hardening. MIDI-07 installs and proves the reversible source-admission capability while leaving admission enabled; STUDIO-06 enables it only after the Studio-native parity gate passes.
- **Why:** MIDI-01–MIDI-06 proved the persisted format and collaboration graph, but the shipped composite surface exposes arrangement fields as form controls rather than a credible music-making workflow. Declaring MIDI parity before musicians can manipulate tracks and clips on a shared timeline or record in project context would leave the prototype without a usable primary creation path when audio admission is disabled.
- **Consequence:** Studio reuses the Jam-owned Signal-derived piano-roll commands, recorder, accessibility inspector, and client-only Tone boundary rather than building a second editor. Audio lanes render authorized waveform peaks; MIDI lanes render note-density/piano-roll summaries. Track headers expose compact gain, pan, mute, solo, preset, readiness, reorder, and MIDI-track duplication controls. Clips support bounded selection, free non-overlapping move, copy/paste, trim, loop, and session undo/redo. Editing a referenced MIDI version creates or resumes a private draft; an explicit command freezes a new immutable version and atomically adds or replaces the selected workspace clip. Mutable draft IDs never enter project manifests, revisions, submissions, or forks, and draft autosave never silently changes an arrangement.
- **Validation:** A new user creates a project in Studio, creates or derives a MIDI part, draws and records notes against project transport, freezes the part, arranges multiple clips on the shared timeline, mixes, saves/reloads, publishes, previews, contributes, accepts, forks, and exports without navigating to a separate editor route. Pointer and keyboard paths produce the same canonical state; audio/MIDI clip state survives immutable round trips; standalone routes still work; old clients cannot bypass the disabled source capability; and existing legacy audio remains private and usable.

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
