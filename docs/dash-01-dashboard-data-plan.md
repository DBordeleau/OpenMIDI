# DASH-01 — Dashboard data plan

Status: implemented by
`supabase/migrations/20260721185457_dash_01_dashboard_data.sql` and the
soft-delete consistency follow-up
`supabase/migrations/20260721192658_dash_01_exclude_deleted_pending_contributions.sql`.
Owner: backend/data change only.

## Why this exists

The dashboard is being redesigned into a launcher: from `/dashboard` a member
should reach any of their work in one press — resume the arrangement they were
last editing, open a project in the Studio, open a recent MIDI clip directly in
the MIDI editor, and jump to the review queue, contributions, or saved clips.

The UI for that is designed and will be implemented separately. **It is blocked
on data the current dashboard payload does not return.** This document specifies
exactly that data.

## Scope boundary — read this first

**In scope:** forward migrations replacing `public.get_viewer_dashboard()`, the
matching repository/type/test changes, and regenerated database types.

**Out of scope — do not change:**

- `src/app/dashboard/page.tsx` or any dashboard UI. The redesign lands in a
  separate change and will conflict with anything you do here. Leave the page
  rendering exactly what it renders today.
- Any styling, layout, `Container` width, or `globals.css`.
- Any other RPC, table, or route.

When the payload is delivered and green, hand back. Do not start the UI.

## Required reading

1. [`AGENTS.md`](../AGENTS.md) — the operating contract. Sections "Database and
   migration rules", "Testing expectations", "Security, privacy, and moderation".
2. [`docs/technical-design/02-data-model.md`](technical-design/02-data-model.md)
   — schema, RLS, quotas.

## What exists today (verified)

### The RPC

`public.get_viewer_dashboard()` — defined at
[`supabase/migrations/20260717000003_collaboration_discovery.sql:439`](../supabase/migrations/20260717000003_collaboration_discovery.sql).

- `LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''`
- Raises `PT401 dashboard_unauthenticated` when `auth.uid()` is null, and
  `PT403 dashboard_forbidden` unless the caller is an `active` profile with
  `profile_completed_at` set.
- Returns one `jsonb` envelope with **camelCase top-level keys** and
  **snake_case row fields**: `ownedProjects`, `activeWorkspaces`,
  `pendingContributions`, `review`. Each list is `limit 7`.
- Revoked from `PUBLIC`, granted to `authenticated`
  (same file, lines 1230–1232).

### The consumer

[`src/server/repositories/dashboard.ts`](../src/server/repositories/dashboard.ts)
validates the envelope with Zod, slices each list to 6, and maps snake_case rows
to camelCase domain objects. Domain types live in
[`src/features/dashboard/types.ts`](../src/features/dashboard/types.ts).

Note lines 70–73 of the repository: workspace archiving is computed in
TypeScript today — 30 days to archive, warning at 23 days.

### Tables you will need

All already exist; **no schema changes are required.**

| Table                          | Relevant columns                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.projects`              | `id, owner_id, title, status, bpm, musical_key, time_signature_numerator, time_signature_denominator, current_revision_id, updated_at, deleted_at` |
| `public.workspaces`            | `id, project_id, owner_id, contribution_id, manifest (jsonb), status, lock_version, updated_at`                                                    |
| `public.workspace_clips`       | `workspace_id, track_id, clip_id, start_tick, duration_ticks, source_start_tick, loop, midi_pattern_version_id`                                    |
| `public.arrangement_clips`     | `arrangement_version_id, project_id, track_id, clip_id, midi_pattern_version_id, start_tick, duration_ticks`                                       |
| `public.midi_patterns`         | `id, owner_id, name, deleted_at`                                                                                                                   |
| `public.midi_pattern_versions` | `id, midi_pattern_id, version_number, created_at, duration_ticks, note_count`                                                                      |
| `public.saved_midi_patterns`   | `user_id, midi_pattern_version_id, source_listing_id, created_at`                                                                                  |
| `public.project_revisions`     | `id, project_id, revision_number, arrangement_version_id`                                                                                          |

Useful existing indexes — the joins below are already covered:

- `workspace_clips_pattern_version_idx` on `(midi_pattern_version_id)`
- `workspace_clips_track_idx` on `(workspace_id, track_id)`
- `arrangement_clips_track_idx` on `(arrangement_version_id, track_id, start_tick, clip_id)`

### The deep link this unblocks

`/studio/{projectId}?editClip={clipId}` already exists and opens the MIDI editor
on that clip — see
[`src/app/studio/[projectId]/page.tsx:23-31`](../src/app/studio/[projectId]/page.tsx).
`editClip` is validated as a UUID and passed through as `initialEditorClipId`.

**This is the crux of the whole plan:** the dashboard cannot build that URL
today. `list_owned_midi_library_versions` returns a member's pattern versions
but not the project or clip that references them. `public.workspace_clips` is
the missing join, and it is already normalized and indexed.

## The change

The base forward migration is
`supabase/migrations/20260721185457_dash_01_dashboard_data.sql`. Because that
migration reached hosted Supabase before the soft-delete list inconsistency was
identified, the forward-only correction is
`supabase/migrations/20260721192658_dash_01_exclude_deleted_pending_contributions.sql`.

Use `CREATE OR REPLACE FUNCTION public.get_viewer_dashboard()`. Do **not** edit
the applied migration that first defined it — that is forbidden by AGENTS.md.
Keep the existing signature, volatility, `SECURITY DEFINER`, `SET search_path TO ''`,
the `PT401`/`PT403` guards, and the existing grants.

### 1. Keep every existing key working

`ownedProjects`, `activeWorkspaces`, `pendingContributions`, `review` must keep
their current shapes. Existing consumers must not break. You are **adding**
fields, not reshaping.

### 2. Extend `ownedProjects` rows

Add to each row:

| Field             | Meaning                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `revision_number` | `project_revisions.revision_number` for `projects.current_revision_id`; `null` when unpublished                  |
| `track_count`     | `count(distinct track_id)` from `arrangement_clips` for the current revision's arrangement; `0` when unpublished |
| `review_count`    | submitted contributions on that project awaiting the owner, capped at 99                                         |

`review_count` is what lets a row say "2 to review" instead of forcing members to
open every project to find the one that needs them.

### 3. Add `resume`

The single most recently updated active workspace owned by the caller, or `null`.
This drives a "pick up where you left off" band with a real miniature of the
arrangement.

```jsonc
"resume": {
  "workspace_id": "uuid",
  "project_id": "uuid",
  "project_title": "text",
  "contribution_id": "uuid|null",
  "contribution_title": "text|null",
  "updated_at": "timestamptz",
  "lock_version": 1,
  "tempo_bpm": 118.0,              // from workspaces.manifest ->> 'tempoBpm'
  "duration_ticks": 15360,         // from workspaces.manifest ->> 'durationTicks'
  "musical_key": "d-minor",        // projects.musical_key, may be null
  "time_signature_numerator": 4,   // projects.time_signature_numerator
  "time_signature_denominator": 4,
  "tracks": [
    {
      "track_id": "uuid",
      "sort_order": 0,
      "preset_id": "text",
      "clips": [
        { "clip_id": "uuid", "start_tick": 0, "duration_ticks": 1920 }
      ]
    }
  ]
}
```

`tracks` is a **pruned projection of `workspaces.manifest`** — take only the five
fields above per track and the three per clip. Do not return the whole manifest;
it is large and the dashboard needs none of the rest.

This is bounded by existing manifest validation: max 32 tracks, max 32 clips per
track (see the manifest guard in
`supabase/migrations/20260717000002_midi_projects_arrangements.sql`).

`clip_id` here is the value the UI will put in `?editClip=`, so each block in the
miniature becomes a direct link into the editor.

### 4. Add `recentClips`

The caller's own MIDI pattern versions that are placed in one of the caller's own
active workspaces, most recently updated first, `limit 7`.

```jsonc
"recentClips": [
  {
    "pattern_id": "uuid",
    "pattern_name": "text",
    "pattern_version_id": "uuid",
    "version_number": 3,
    "project_id": "uuid",
    "project_title": "text",
    "workspace_id": "uuid",
    "clip_id": "uuid",
    "duration_ticks": 7680,
    "note_count": 32,
    "updated_at": "timestamptz"
  }
]
```

Join path:

```
midi_patterns (owner_id = caller, deleted_at is null)
  → midi_pattern_versions (midi_pattern_id)
  → workspace_clips (midi_pattern_version_id)      -- indexed
  → workspaces (id, owner_id = caller, status = 'active')
  → projects (id, deleted_at is null)
```

**Both ownership filters are required.** A pattern the caller owns can be placed
in someone else's workspace, and a workspace the caller owns can contain someone
else's pattern. Neither may leak: return only rows where the caller owns _both_.

De-duplicate to one row per `pattern_version_id`, preferring the most recently
updated workspace, so the same clip does not appear repeatedly.

### 5. Add `counts`

Every count is **bounded** using the same pattern as the existing `review` key —
count over a `limit 100` subquery and return `least(count(*), 99)` plus a
`hasMore` boolean. Do not run unbounded counts.

| Key                    | Counts                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| `projects`             | caller's non-deleted `draft`/`active` projects                      |
| `clips`                | caller's non-deleted `midi_patterns`                                |
| `savedClips`           | caller's rows in `saved_midi_patterns`                              |
| `pendingContributions` | caller's `draft`/`submitted`/`changes_requested` contributions      |
| `archivingSoon`        | caller's active workspaces older than the archive warning threshold |

`archivingSoon` must use the **same threshold** the repository already applies:
warn at 23 days, archive at 30. That constant currently lives only in
`src/server/repositories/dashboard.ts:73`. Extract it to a shared TypeScript
module, mirror the value in SQL, and leave a comment in both places pointing at
the other — a silent drift here would show a warning badge that the row detail
contradicts.

The existing lists are capped at 7, so these counts are the only honest source
for "you have 24 clips". Do not derive counts from array lengths.

### 6. Repository, types, tests

- Extend the Zod schema and the mapper in
  [`src/server/repositories/dashboard.ts`](../src/server/repositories/dashboard.ts).
  Keep the snake_case → camelCase mapping at the repository boundary; domain
  types stay camelCase and smaller than row types.
- Extend [`src/features/dashboard/types.ts`](../src/features/dashboard/types.ts).
  `resume` is nullable. `recentClips` may be empty.
- Regenerate types: `npm run db:types`. Never hand-edit the generated file.
- Add database tests alongside the existing suite in `supabase/tests/`, following
  the numbering convention (the nearest relevant existing file is
  `00220_profile_dashboard_navigation.test.sql`).

## Authorization tests (required, not optional)

AGENTS.md requires every RLS-sensitive feature to cover anonymous, author,
unrelated authenticated user, owner, and suspended user. For this payload, at
minimum:

1. **Anonymous** caller → `PT401`.
2. **Suspended / incomplete profile** → `PT403`.
3. **Unrelated authenticated user** sees none of another member's projects,
   workspaces, clips, or counts — assert empty, not merely "different".
4. **Caller's pattern in a foreign workspace** does not appear in `recentClips`.
5. **Foreign pattern in the caller's workspace** does not appear in
   `recentClips`.
6. **Deleted project / deleted pattern** is excluded everywhere.
7. **`resume` is null** when the caller has no active workspace.
8. **Counts are capped** at 99 with `hasMore` true beyond that.

Tests 4 and 5 are the ones most likely to be missed and the ones that leak.

## Constraints

- Forward-only migration. Never modify an applied one.
- `SECURITY DEFINER` + `SET search_path TO ''` + schema-qualify every reference.
  Keep `REVOKE ... FROM PUBLIC` and grant execute to `authenticated` only.
- Every subquery filters on `auth.uid()`. A `SECURITY DEFINER` function bypasses
  RLS, so the `WHERE` clauses are the entire authorization boundary here.
- Everything stays bounded — the envelope must not grow with account size.
- No new tables, columns, or indexes should be needed. If you conclude one is,
  stop and surface it rather than adding it.
- Do not log manifests, tokens, or payloads.

## Verification

Run and report actual output — do not claim a check passed without running it.

```bash
npm run db:reset      # migrations apply from clean
npm run db:test       # includes your new tests
npm run db:types      # regenerate; commit the result
npm run db:types:check # no drift
npm run check         # lint, typecheck, unit, build
```

Database commands need a running Docker-compatible engine and
`npm run supabase:start`. Stop it when finished.

## Definition of done

- `get_viewer_dashboard()` returns the extended envelope, all existing keys
  unchanged.
- Migration applies from a clean database; generated types committed with it.
- The authorization tests above pass, including the two leak cases.
- The archive-warning threshold exists once in TypeScript and is mirrored in SQL
  with a comment linking them.
- The dashboard page still renders exactly as before — you changed no UI.
- Handoff notes state what was added, what was verified, and anything you had to
  assume.
