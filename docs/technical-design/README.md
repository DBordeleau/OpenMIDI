# Jam Session Technical Design

Status: Accepted MVP design; implementation in progress

Last updated: 2026-07-13

Companion: [`PRD.md`](../PRD.md)

## Purpose

This document set turns the product requirements into an implementation contract. It is intentionally split by concern so coding agents can load the smallest useful context while preserving one source of truth.

| Document                                               | Use it for                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [01-system-architecture.md](01-system-architecture.md) | Runtime boundaries, request flows, browser studio integration, security and deployment |
| [02-data-model.md](02-data-model.md)                   | PostgreSQL/Supabase schema, invariants, storage layout and RLS                         |
| [03-delivery-plan.md](03-delivery-plan.md)             | Milestones, vertical slices, testing, observability and agent execution rules          |
| [decisions/README.md](decisions/README.md)             | Architectural decisions that must remain stable across implementation tasks            |

## Implementation pulse after PR 11

The following vertical slices are implemented and are the baseline for future work:

- repository/Next.js quality scaffold and responsive global product shell with progressively enhanced Auth-aware navigation;
- local Supabase migrations, pgTAP, generated database types, and user-scoped clients;
- identity schema, invite-only Google OAuth, onboarding, settings, and safe public profiles;
- private project metadata, owner membership, controlled licenses/genres/tags/instruments, idempotency, and optimistic metadata updates;
- private immutable WAV/FLAC/MP3 assets, direct resumable Storage uploads, trusted verification, and user/global quota projections;
- strict manifest v1, immutable revisions/tracks, append-only project asset references, project storage projection, and atomic idempotent first publish;
- authenticated current-revision studio playback with lazy Waveform Playlist hydration, exact-revision short-lived signed URLs, synchronized transport, and session-only mixer controls.
- owner-only editable workspaces created from the exact current revision, normalized workspace-track projections, private immutable recovery snapshots, debounced autosave, optimistic lock conflicts, and local crash recovery.
- owner workspace publication through the canonical immutable-revision transaction, idempotent workspace advancement, explicit stale-draft restart, authorized direct-to-Storage stem downloads, and bounded browser-rendered 16-bit WAV mix export.

The next planned slice adds contribution drafts and immutable submission versions. Contribution review/acceptance, attribution UI, forks, public discovery, dashboards, moderation/retention jobs, and final release hardening remain unimplemented. Historical PR 05 spike evidence is retained; [PR 09 evidence](evidence/pr-09-production-studio.md), [PR 10 evidence](evidence/pr-10-editable-workspaces.md), and [PR 11 evidence](evidence/pr-11-export-download-publishing.md) describe the production studio path.

## Executive recommendation

Use a Next.js App Router application deployed to Vercel, Supabase for Auth/Postgres/Storage, Tailwind CSS for styling, and Motion for intentional interaction animation. Build the MVP browser studio with pinned MIT-licensed Waveform Playlist packages behind a Jam Session-owned client-only adapter.

This is a good fit because most of Jam Session is a server-rendered social and project-management application, while audio editing is a distinct browser-only workload. Waveform Playlist provides the stem timeline, synchronized playback, mixer controls and export primitives required by the MVP without making a full DAW runtime or opaque native project format part of the persistence contract.

## Product decisions added to make the PRD implementable

The PRD is directionally strong. The following interpretations are normative for the MVP:

1. A **project** is the long-lived collaboration identity and metadata page.
2. A **revision** is an immutable, playable snapshot of workspace state plus referenced audio assets.
3. Editing occurs in a private **workspace draft**. Saving updates the draft; publishing creates a revision.
4. A **contribution** points to an immutable proposed revision based on a specific project revision. Acceptance creates a new project revision; it never mutates history.
5. A **fork** creates a new project whose first revision records its source project and source revision.
6. Audio objects are immutable. Replacing audio means creating a new asset and a new revision.
7. Public discovery only indexes published, public, active projects. Draft and unlisted content never appears in discovery.
8. “Trending” begins as a deterministic recent-activity score. It is not an ML or recommendation system.
9. The MVP has one project owner. A membership table is retained for future collaborators, but owner-only review and project mutation is the initial policy.
10. Licensing/usage terms must be selected before public uploads. At minimum a project declares a collaboration license or explicit “all rights reserved”; the UI must not imply that public visibility grants remix rights.

## Resolved MVP operating decisions

The initial demo uses the following bounded policies:

- Waveform Playlist is the selected MVP browser editor. Pin its direct packages exactly, retain their MIT notices, and keep access behind the studio adapter.
- OpenDAW integration is post-MVP. Reintroducing it requires a new architecture decision, integration spike, persisted-format compatibility plan and licensing review.
- Authentication is Google-only. Additional identity providers are post-MVP.
- Audio uploads accept WAV (`audio/wav`, `audio/x-wav`), FLAC (`audio/flac`) and MP3 (`audio/mpeg`). FLAC is the recommended lossless format.
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
- Waveform Playlist and Tone.js types do not escape `features/studio/waveform-playlist-adapter`; domain code speaks only in Jam Session manifest and adapter types.

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
