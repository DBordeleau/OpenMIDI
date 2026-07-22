# Architecture Decision Records

ADRs preserve decisions that coding agents must not silently revisit. A changed decision requires a superseding ADR, not an unannounced implementation deviation.

## Decision status

ADR-001 through ADR-005 retain the platform, client-only runtime, immutable-history, portable-manifest, and copy-on-write foundations, except that ADR-020 supersedes ADR-002's bounded avatar-object storage clause. ADR-006 through ADR-009 are historical/superseded where they describe Waveform Playlist, manifest v1/v2, uploaded musical media, source admission, or the old OPT/MIDI/STUDIO sequence. ADR-010 through ADR-014 are the current MIDI-only authority and are implemented through the completed PIVOT-10 hosted rebaseline, with ADR-020 superseding later avatar-Storage consequences. ADR-015's compatibility-preserving rename is superseded. ADR-016 adds the public-library rights gate, external-credit boundary, and copyright-report posture to ADR-013's single-license decision. ADR-017 fixes challenge versioning, time-derived phases, exact entry publication, and authoritative constraint/result boundaries. ADR-018 authorizes the one-time prelaunch clean OpenMIDI namespace and disposal of existing musical domain data; Git history preserves earlier wording. ADR-019 adopts deterministic local generated avatars; ADR-020 completes the upload-system retirement.

## Accepted for initial implementation

### ADR-001: Next.js application with a client-only studio boundary

- **Decision:** Use Next.js App Router for the product and a dynamically loaded client-only studio feature.
- **Why:** Public/social pages benefit from server rendering while Web Audio and the MIDI editor/runtime require browser APIs.
- **Consequence:** No browser editor, Tone.js, or Web Audio import may enter a Server Component or shared server module.

### ADR-002: Supabase as identity, relational authority and bounded object storage

- **Decision:** Use Supabase Auth and Postgres and apply RLS to all exposed public-schema tables. The original bounded avatar-object storage clause is historical and superseded by ADR-020.
- **Why:** It matches the MVP needs and avoids a bespoke service tier.
- **Consequence:** Service-role access is exceptional; ordinary workflows remain user-scoped and policy-tested.

### ADR-003: Immutable revisions with mutable private workspaces

- **Decision:** Published work and submitted contributions are immutable snapshots; autosave targets private workspace drafts.
- **Why:** Reliable attribution, forks, review and recovery require stable history.
- **Consequence:** Acceptance creates a revision rather than updating one.

### ADR-004: OpenMIDI manifest is the portable workspace authority

> Superseded for the MIDI-only target by ADR-011. This remains the historical authority for manifest v1/v2 behavior until the pivot cutover removes it.

- **Decision:** Persist a versioned OpenMIDI JSON manifest and normalized track projection; do not require an opaque editor-native snapshot for MVP reopen.
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
- **Consequence:** OpenMIDI owns serialization, product-specific controls, accessibility integration and manifest migrations. OpenDAW remains a post-MVP alternative and cannot be introduced without superseding this ADR.

### ADR-007: MIDI-first prototype with dormant new-audio admission

> Superseded by ADR-010 through ADR-014. Retained as historical context for the completed MIDI-first interruption.

- **Decision:** After the $0 audio-optimization pass, add a standalone owner-scoped MIDI-stem editor/library and a project path that references exact immutable stem versions, using deterministic bundled Tone.js synthesis behind a platform-owned composite client-only adapter. When the complete MIDI creation/collaboration parity gate passes, disable new `source_audio` reservation globally for the prototype without adding billing or entitlements.
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
- **Decision:** OpenMIDI's target MVP accepts, stores, versions, previews, and collaborates on structured MIDI only. Remove uploaded source audio, legacy-audio compatibility, Waveform Playlist, source verification/admission, waveform peaks, audio quotas/retention, and server-stored audio previews through PIVOT-04–PIVOT-09. Retain browser-only synthesized playback/local audio export. The historical profile-avatar Storage exception is superseded by ADR-020.
- **Why:** Repeated full-quality source retrieval exhausted an unsustainable share of the $0 prototype egress budget, while structured MIDI supports the newly accepted public creation/remix/challenge product more directly.
- **Consequence:** The staged cutover and hosted rebaseline are complete through PIVOT-10. Historical audio evidence stays in Git/docs but is not current product authority. Any future uploaded-audio support requires a new PRD, cost model, and superseding ADR.
- **Validation:** The clean baseline and rebaselined hosted project have no source-audio route, bucket, function, cron, quota, schema, dependency, fixture, or product promise; MIDI creation/collaboration remains complete.

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
- **Why:** CC BY permits sharing, adaptation, and commercial use while requiring attribution, matching OpenMIDI's automatic lineage/credit product. One license avoids an MVP compatibility matrix and custom legal terms.
- **Consequence:** Required creator/source/license/change attribution cannot be removed. MIDI downloads include attribution/license material outside the `.mid` payload. Other licenses, payments, and rights-dispute resolution are deferred; public terms still require legal review before unrestricted launch.
- **Validation:** Copy-on-write reuse preserves exact source/creator/license snapshots through publish, contribution, fork, export, profile rename, and deletion.

### ADR-014: Same Git repository, clean migration baseline, and same-project hosted rebaseline

- **Status:** Accepted 2026-07-16; hosted-project clause amended 2026-07-16 and executed by PIVOT-10 on 2026-07-17.
- **Decision:** Refactor this repository on `midi-only-pivot`, preserve pre-pivot history, replace the historical migration chain with a reviewed MIDI-only baseline, and destructively reset the existing hosted Supabase project to that baseline. Retain its project reference, URL, API keys, OAuth provider configuration, and environment bindings; retain no existing application, Auth, or Storage data.
- **Why:** Identity, Studio, collaboration, moderation, design, testing, and existing deployment configuration are worth retaining. Clearing managed data and obsolete project resources before a linked reset removes the legacy audio system without consuming another Free-plan project or rotating every integration credential.
- **Consequence:** PIVOT-10 completed the one authorized destructive hosted mutation through supported Storage/Auth/management APIs and one linked four-migration reset. Future hosted mutation again requires explicit operational authority. There is no second-project rollback boundary; Git preserves schema history but deleted hosted data is intentionally unrecoverable except through any provider-managed backup.
- **Validation:** A clean local reset and the same-project hosted reset reproduce the same migration history, types, RLS, and MIDI behavior; only Auth/Postgres plus approved avatar Storage/processing remain, and project URLs/API keys do not change.

### ADR-015: OpenMIDI product name with stable persisted identifiers

- **Status:** Superseded by ADR-018 on 2026-07-18 before public launch.
- **Decision:** The initial rename decision would have retained the former prelaunch technical namespace for serialized compatibility.
- **Why superseded:** There are no launched users or production musical records requiring compatibility, and retaining a permanent second identity creates avoidable maintenance and product confusion.
- **Historical consequence:** Git history preserves the earlier decision. Current implementation follows ADR-018.

### ADR-016: Rights-gated public MIDI listings, reuse modes, and separate external credits

- **Status:** Accepted 2026-07-17; amended 2026-07-17 to add reference-only listings; subject to legal review before unrestricted public launch.
- **Decision:** Public library listings declare exactly one mode: commercially reusable under CC BY 4.0, or reference-only with no reuse grant. Reference-only listings remain searchable, previewable, and inspectable, but cannot be saved to the reusable collection, imported, forked, opened as an editable copy, or exported through library actions. Reuse mode is immutable for an exact listed version: an existing CC BY grant cannot be downgraded, while a reference-only version has no reuse license and instead requires a separate public-display attestation. Require a versioned rights-basis choice and affirmative authority attestation for the selected public display/reuse mode. Wholly original, compatibly licensed adaptations, and supportable public-domain material may proceed with required source terms only when those rights support the selected mode; uncertain-rights covers, recreations, or adaptations cannot enter either public mode. Store immutable external credits separately from verified OpenMIDI creator/source lineage. Add a dedicated unoriginal/unauthorized-work report reason and moderator hide/review/restore authority over listings without rewriting pattern notes or project history.
- **Why:** A MIDI file can embody a protected musical composition even without a sound recording. [Creative Commons](https://creativecommons.org/faq/) states that licensors should not apply a CC license to material they do not own or lack authority to license, while the [U.S. Copyright Office](https://www.copyright.gov/engage/musicians/) distinguishes rights in the underlying musical work from rights in a recording. Attribution acknowledges a source but does not create permission, and offering more CC choices would not cure missing underlying rights.
- **Consequence:** Library Explore exposes All/commercially-reusable/reference-only filtering and every card/detail page labels its mode accessibly. Publication UX must educate and sometimes block instead of implying that reference-only status or a license dropdown legalizes a cover. Compatible adaptations record source license/permission and external credits; permitted exports display them. Reports and claimant context remain private, while public projections show only approved listing/credit/terms data. OpenMIDI does not warrant ownership merely because a user attested, and must publish an operator copyright/contact process before unrestricted launch.
- **Validation:** Tests cover each rights-basis/mode branch, combined filter queries, authoritative denial of reference-only save/import/fork/edit/export, incompatible/uncertain blocking, immutable external-credit snapshots, permitted copy-on-write/export propagation, dedicated reporting, moderator hide/restore, and RLS denial of private reports/claimant evidence.

### ADR-017: Versioned curated challenges with time-derived phases and exact public entries

- **Status:** Accepted 2026-07-18.
- **Decision:** MVP challenges are administrator-curated stable identities whose editable content is append-only immutable challenge versions. Each version freezes its prompt, presentation, UTC schedule, judging credits, optional exact starter revision, and validated constraint document/hash. Public scheduled/open/voting phases derive from those timestamps without cron; completion and cancellation are explicit audited commands. An entry pins one exact challenge version and one immutable current project revision, and submission grants challenge-scoped public display of that revision without changing the source project's visibility or granting library reuse. Advisory TypeScript preflight and authoritative Postgres submission evaluation use the same versioned rule vocabulary and parity fixtures. Votes remain private until close; finalized results are append-only and corrections supersede rather than rewrite a prior result.
- **Why:** Immutable versions keep entrants bound to the rules they saw, normalized exact references preserve project history, and time-derived phases avoid a fragile scheduled worker on the $0 prototype. A narrow entry projection permits private-project participation without exposing the project, workspace, membership, or unrelated revision history.
- **Consequence:** Draft edits append challenge versions; published challenge versions cannot be rewritten. CHALLENGE-01 owns lifecycle/version authority, CHALLENGE-02 owns eligibility and exact entries, and CHALLENGE-03 owns voting/moderation/results/featured discovery. Administrators—not named host/judge credits—hold mutation authority. User-created challenges, programmable rule code, cash prizes, and generic social scoring remain deferred.
- **Validation:** Clean migration and RLS tests cover anonymous, active, unrelated, administrator, entrant, project owner, and suspended actors; deterministic fixtures prove TypeScript/Postgres eligibility parity; browser coverage proves admin creation, actionable failed preflight, exact replacement, hidden pre-close totals, no self-vote, permanent completed results, and no private-project leakage.

### ADR-018: Prelaunch clean OpenMIDI namespace and disposable musical data

- **Status:** Accepted 2026-07-18; supersedes ADR-015.
- **Decision:** OpenMIDI is the only identity retained in the current repository. RELEASE-01 replaces the former working name across product copy, repository/package metadata, runtime and browser namespaces, persisted manifest/diff engine identifiers, test actors/fixtures, local Supabase identity, current documentation, and clean migration source. Because the product has not launched, existing projects, revisions, patterns, clips, workspaces, contributions, challenge entries/results, and derived awards may be deleted instead of migrated. The retained hosted Supabase project, project reference, API configuration, Auth identities, operator roles/invitations, feedback, and avatar infrastructure remain unless the reviewed reconciliation proves a narrower dependency requires removal.
- **Why:** One clean namespace is cheaper to reason about and test than permanent prelaunch compatibility. Deleting disposable musical data avoids a risky JSON/normalized-history conversion while keeping the existing Free-plan project and integrations.
- **Consequence:** RELEASE-01 is a one-time exception to migration-source immutability: it updates the clean baseline for fresh resets and adds a forward reconciliation migration for the already-retained hosted project. That migration must delete musical data in dependency-safe transactional order, replace runtime constraints/functions/preset engine values, and be locally tested but not hosted-applied. RELEASE-03 alone may execute it with explicit authority. After RELEASE-01, migrations and OpenMIDI identifiers are immutable again. Git history, not the active tree, preserves the former identity.
- **Validation:** A case-insensitive tracked-tree scan finds no former product/namespace reference; clean reset, generated types, pgTAP, manifest-v3 round trips, browser creation/publication/export, and deterministic engine/diff fixtures use only OpenMIDI identifiers. The hosted rollout preflight confirms the same project, records disposable row counts, preserves named non-musical state, applies the forward reconciliation, and proves no former runtime value remains.

### ADR-019: Deterministic local generated profile avatars

- **Status:** Accepted 2026-07-22.
- **Decision:** Represent optional profile avatars as a validated version-1 configuration for the bundled DiceBear Adventurer Neutral style. Pin `@dicebear/core` 10.3.0 and `@dicebear/styles` 10.2.0, derive the seed from the profile UUID, persist configuration only, render a data URI locally, and keep initials as the valid null state. AVATAR-01 expands the schema while uploaded avatars remain compatible; later reviewed slices cut application reads over and retire avatar Storage.
- **Why:** A compact deterministic preference avoids photo processing, Storage capacity, public derivatives, runtime network requests, and external renderer drift while keeping avatar customization expressive and optional.
- **Consequence:** Configuration version 1 freezes the supported option catalogs, ranges, palette, renderer packages, and style. Stored SVG, generated image bytes, remote DiceBear URLs, email-derived seeds, and silently normalized database values are prohibited. Package/style upgrades require a new compatibility decision and renderer fixtures. AVATAR-03 completed the separately gated destructive cutover.
- **Validation:** Shared runtime and database validators reject unknown or out-of-range configuration, authorized commands derive the seed and enforce optimistic concurrency, representative output is fingerprinted, public reads expose no private revision/lifecycle state, and rendering requires no network or Storage access.

### ADR-020: Retire uploaded avatars and avatar object storage

- **Status:** Accepted and implemented by AVATAR-03.
- **Decision:** OpenMIDI accepts no profile-image upload. Persist only optional versioned avatar configuration in Postgres, render with pinned local DiceBear packages, and use initials for `NULL`. Remove avatar asset/version tables, Storage admission, processing/cleanup workers, uploaded-avatar RPCs, asset holds, avatar retention branches, legacy profile pointers, the Edge Function, and its recovery secret.
- **Why:** The generated-avatar path removes user-image privacy and moderation burden, object capacity and cleanup operations, worker recovery, and external renderer availability while preserving deterministic customization.
- **Consequence:** Generic project/contribution/profile moderation, legal holds, deletion expiry, moderation-metadata retention, account deletion, and recovery remain authoritative. Historical bucket registrations may exist after clean replay, but no application policy, code path, or command can place objects in them.
- **Validation:** The forward migration aborted on legacy objects, active avatar-asset holds, or live image/cleanup leases; the reviewed hosted interlock, postflight, and linked-ledger reconciliation completed before merge; clean replay and pgTAP prove the final schema and privileges; the static contract rejects active upload, remote rendering, and image-worker infrastructure.

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
