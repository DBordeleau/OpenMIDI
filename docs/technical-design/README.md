# Jam Session Technical Design

Status: Accepted MVP design; implemented through PR 17 and OPT-05 with MIDI-first expansion planned before PR 18

Last updated: 2026-07-14

Companions: [`PRD.md`](../PRD.md) for product intent, [`ROADMAP.md`](../ROADMAP.md) for delivery status/sequence, and [`design/brand.md`](../design/brand.md) for user-facing voice and visual design

## Purpose

This document set turns the product requirements into an implementation contract. It is intentionally split by concern so coding agents can load the smallest useful context while preserving one source of truth.

For any user-facing surface, treat the brand guide as the presentation contract alongside this technical design. Technical authorization, data, runtime, and persistence rules remain authoritative here; product voice, semantic visual tokens, shared button treatment, typography, motion, and established presentation patterns are authoritative in the brand guide.

| Document                                               | Use it for                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [01-system-architecture.md](01-system-architecture.md) | Runtime boundaries, request flows, browser studio integration, security and deployment |
| [02-data-model.md](02-data-model.md)                   | PostgreSQL/Supabase schema, invariants, storage layout and RLS                         |
| [03-delivery-plan.md](03-delivery-plan.md)             | Milestones, vertical slices, testing, observability and agent execution rules          |
| [decisions/README.md](decisions/README.md)             | Architectural decisions that must remain stable across implementation tasks            |

## Current implementation pulse

The following vertical slices are implemented and are the baseline for future work:

- repository/Next.js quality scaffold and responsive global product shell with active-route navigation and an authenticated member project index;
- local Supabase migrations, pgTAP, generated database types, and user-scoped clients;
- identity schema, invite-only Google OAuth, onboarding, settings, and safe public profiles;
- private project metadata, owner membership, controlled licenses/genres/tags/instruments, idempotency, and optimistic metadata updates;
- private immutable WAV/FLAC/MP3 assets, direct resumable Storage uploads, automatic lease-bound trusted verification with bounded recovery/retry, source-only user upload history, and user/global quota projections;
- strict manifest v1, immutable revisions/tracks, append-only project asset references, project storage projection, and atomic idempotent first publish;
- authenticated current-revision studio playback with lazy Waveform Playlist hydration, exact-revision short-lived signed URLs, synchronized transport, session-only mixer controls, initialized-state guards, and the documented Next.js 16.2.10 Firefox streaming workaround;
- owner-only editable workspaces created from the exact current revision, normalized workspace-track projections, private immutable recovery snapshots, debounced autosave, optimistic lock conflicts, and local crash recovery;
- owner workspace publication through the canonical immutable-revision transaction, idempotent workspace advancement, explicit stale-draft restart, authorized direct-to-Storage stem downloads, and bounded browser-rendered 16-bit WAV mix export.
- private already-authorized member contribution drafts rooted at exact revisions, contribution-aware autosave through the existing studio boundary, immutable attested submission versions, withdrawal with retained history, and owner visibility beginning only after submission.
- exact-version owner review with request changes/rejection and atomic stale-safe acceptance into immutable history;
- explicit ordered self/external source-credit confirmation, immutable per-revision track snapshots, distinct publisher and accepted-contributor attribution, and privacy-safe authenticated/public history;
- copy-on-write forks with exact lineage and no source-byte duplication; and
- owner-controlled public visibility, anonymous metadata/credit pages, bounded Explore search/filtering, deterministic recent/trending ordering, and public fork/contribution entry without public source audio.
- independently paginated public profile history, a bounded authenticated dashboard and private indexes, throttled recent activity, responsive disclosure navigation, and trusted private-original/public-derived profile avatars.
- manifest-first progressive audio delivery, bounded actor-scoped reuse, lossless browser WAV-to-FLAC optimization, and compact private persisted waveform peaks that render before canonical source decode without changing manifest or source authority.

Profiles and private-work navigation are implemented through PR 17, and the five-slice $0 audio-delivery optimization is complete. The controlled studio shell is ready in milliseconds; browser-generated FLAC reduces the synthetic three-stem fixture by 40.24%, while its 17.709-second cold playback remains bounded by 42.7 MB at 20 Mbit/s. The roadmap now proceeds to MIDI-first expansion before moderation/retention and final release hardening. MIDI becomes the active prototype creation path; new source-audio admission is disabled only after MIDI reaches end-to-end parity, while existing audio history remains supported. A stored legacy-audio mix preview remains a separate future delivery decision, not part of MIDI-native preview playback. Historical evidence remains indexed under [`evidence/`](evidence/).

## Executive recommendation

Use a Next.js App Router application deployed to Vercel, Supabase for Auth/Postgres/Storage, Tailwind CSS for styling, and Motion for intentional interaction animation. Evolve the MVP browser studio into a Jam Session-owned composite client-only adapter: pinned Tone.js provides MIDI scheduling/synthesis, while pinned Waveform Playlist packages preserve existing audio compatibility.

This is a good fit because most of Jam Session is a server-rendered social and project-management application, while MIDI/audio editing is a distinct browser-only workload. Deterministic bundled synthesis makes new MIDI projects inexpensive to store and transfer; Waveform Playlist retains the stem timeline, synchronized playback, mixer controls, and export primitives required by existing audio history. Neither runtime becomes persistence authority.

## Product decisions added to make the PRD implementable

The PRD is directionally strong. The following interpretations are normative for the MVP:

1. A **project** is the long-lived collaboration identity and metadata page.
2. A **revision** is an immutable, playable snapshot of workspace state plus any referenced audio assets and bounded MIDI events/preset versions.
3. Editing occurs in a private **workspace draft**. Saving updates the draft; publishing creates a revision.
4. A **contribution** points to an immutable proposed revision based on a specific project revision. Acceptance creates a new project revision; it never mutates history.
5. A **fork** creates a new project whose first revision records its source project and source revision.
6. Audio objects are immutable. Replacing audio means creating a new asset and a new revision. MIDI edits remain mutable only in a workspace and become immutable when published/submitted.
7. Public discovery only indexes published, public, active projects. Draft and unlisted content never appears in discovery.
8. “Trending” begins as a deterministic recent-activity score. It is not an ML or recommendation system.
9. The MVP has one project owner. A membership table is retained for future collaborators, but owner-only review and project mutation is the initial policy.
10. Licensing/usage terms must be selected before public uploads. At minimum a project declares a collaboration license or explicit “all rights reserved”; the UI must not imply that public visibility grants remix rights.
11. New projects become MIDI-first after the planned expansion. MIDI notes/clips are versioned manifest content and bounded relational projections, not Storage assets.
12. New source-audio admission is globally disabled only after the MIDI creator/collaboration parity gate. This is not a payment or entitlement model.
13. Existing audio projects and immutable history remain private, playable, downloadable, exportable, publishable, contributable, and forkable; no audio history is converted or deleted by the capability change.

## Resolved MVP operating decisions

The initial demo uses the following bounded policies:

- Waveform Playlist is the selected MVP browser editor. Pin its direct packages exactly, retain their MIT notices, and keep access behind the studio adapter.
- OpenDAW integration is post-MVP. Reintroducing it requires a new architecture decision, integration spike, persisted-format compatibility plan and licensing review.
- Authentication is Google-only. Additional identity providers are post-MVP.
- Audio uploads accept WAV (`audio/wav`, `audio/x-wav`), FLAC (`audio/flac`) and MP3 (`audio/mpeg`). FLAC is the recommended lossless format.
- The optimization pass may convert a newly selected WAV to canonical lossless FLAC in a browser worker with explicit copy and fallback; existing assets are never rewritten.
- After MIDI parity, `reserve_source_asset` rejects new source admission through a trusted global prototype capability. Existing reservations follow a documented deployment grace rule and existing ready assets remain supported.
- MIDI sounds use immutable versioned Tone.js synthesis presets without remote sample libraries in the initial expansion. Hardware Web MIDI is optional progressive enhancement; pointer, keyboard, and on-screen input remain complete.
- Limits are 45 MiB and 10 minutes per audio file, 12 source stems and 250 MiB of uniquely referenced source audio per project, 200 MiB of owned source audio per user, and an 850 MiB global Storage soft stop.
- Rejected contributions remain visible to their author and the project owner while the project exists. They are not public discovery content.
- The demo is invite-only, uses user reporting plus manual administrator review, and follows the retention schedule in the architecture document.

## Remaining launch questions

- Default project license and contributor attestation language.
- Production-scale quotas, moderation operations, appeal process and statutory takedown contact.

## Global engineering invariants

- IDs are UUIDv7 where application-generated ordering is useful; Supabase Auth user IDs remain their provided UUIDs.
- Database columns use `snake_case`; TypeScript domain objects use `camelCase` and are mapped at the repository boundary.
- Timestamps are `timestamptz` in UTC. Clients format them for display.
- All public-schema tables have RLS enabled. The service-role key is server-only and is not used for normal user requests.
- Files are addressed by database asset IDs, never by user-provided paths.
- A database row is the authority for access to a stored object; bucket policies mirror that authority.
- Published revisions and accepted contribution snapshots are immutable.
- Route handlers and server actions validate input with shared schemas and authorize at the data boundary.
- Waveform Playlist and Tone.js types do not escape the documented client-only studio adapter or its MIDI/composite successor; domain code speaks only in Jam Session manifest and adapter types.

## Suggested repository shape

```text
src/
  app/                         # routes, layouts, server actions, route handlers
  components/                  # reusable UI primitives
  features/
    auth/
    profiles/
    projects/
    contributions/
    discovery/
    studio/
      waveform-playlist-adapter/ # sole Waveform Playlist/Tone.js dependency boundary
  lib/
    supabase/                  # browser/server/admin client factories
    validation/                # shared input schemas
    observability/
  server/
    repositories/              # typed database access
    services/                  # use-case transactions and authorization
supabase/
  migrations/                  # reviewed, forward-only SQL
  seed.sql
tests/
  e2e/
docs/technical-design/
```

Do not create a generic `utils` dumping ground. Code shared by only one feature stays inside that feature.
