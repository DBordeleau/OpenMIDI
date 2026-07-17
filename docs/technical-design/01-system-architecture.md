# System architecture

Status: Current after PIVOT-09
Deployment state: repository-local authority; same-project hosted rebaseline is approved but not executed

## Runtime boundaries

Jam Session is a Next.js App Router application backed by Supabase Auth and Postgres. Supabase Storage is used only for private avatar originals and sanitized public avatar derivatives. PIVOT-10 destructively rebaselined and verified the existing hosted project without changing its project reference or API keys. Vercel is the intended host, but no Vercel project or deployment exists yet.

The Studio is a lazy client boundary. Tone.js, Web MIDI, browser playback, MIDI import/export, and synthesized local audio export stay inside `src/features/studio/midi-adapter` and the focused instrument runtime. Server Components, actions, route handlers, repositories, and database code operate on validated structured MIDI and never import Tone.js or browser media APIs.

```mermaid
flowchart LR
  UI["Next.js routes and Server Components"] --> Actions["Actions and route handlers"]
  Actions --> Services["Authorized services and repositories"]
  Services --> DB["Supabase Postgres + RLS"]
  Studio["Lazy client-only MIDI Studio"] --> Runtime["Manifest v3 + Tone.js presets"]
  Studio --> Actions
  Runtime --> Downloads["Local .mid / synthesized audio downloads"]
  Avatar["Avatar UI and operator"] --> Storage["Private originals / public derivatives"]
  Avatar --> DB
```

Local synthesized audio is ephemeral and downloadable; it is never uploaded, shared, versioned, or authoritative.

## Main workflows

### Identity and profiles

Supabase Auth owns email and provider identity. A Before User Created hook checks private invitations. The Auth insert trigger creates an incomplete private profile. Username claiming and profile completion are authorized database commands. Public reads use the security-invoker `public_profiles` projection; lifecycle and activity fields remain private.

### Studio and publication

The client edits a canonical manifest-v3 workspace. `save_midi_workspace_v3` validates the complete manifest, replaces normalized workspace tracks/clips, advances optimistic `lock_version`, and records one of at most 20 Postgres recovery snapshots. Publication freezes an immutable arrangement version and normalized projections, then appends a project-revision wrapper in the same transaction.

### Contributions and forks

A contribution workspace begins from an exact base project revision. Submission freezes one immutable arrangement version. Acceptance is stale-base aware and appends a project revision pointing to that exact accepted arrangement; it does not merge automatically. Forking copies project metadata and arrangement projections while retaining exact source project/revision and pattern-version lineage.

### Public reads and discovery

Public project pages, preview, history, attribution, and discovery read arrangement versions and exact MIDI pattern versions. Pattern creator snapshots and CC BY 4.0 lineage survive profile renames and deletion. Public pattern-library listing is a later explicit feature, separate from project publication.

### Moderation, deletion, and avatars

Reports do not hide content. Admin actions change moderation state through security-definer commands with pinned `search_path`. Recoverable deletion preserves immutable references and honors content holds. Avatar originals use a private bucket; sanitized derivatives use a public bucket. The bounded retention operator can delete only proven avatar candidates.

## Authority and security

- Postgres relationships and commands are authoritative; JSON manifests are validated portable snapshots.
- Normal application access is user-scoped and RLS-protected. Service role is limited to local fixtures and bounded avatar/retention operators.
- Published revisions, arrangement versions, pattern versions, contribution versions, attributions, and lineage are immutable.
- Public layouts remain Auth-independent; verified claims/user calls provide identity where required.
- Security-definer functions pin an empty `search_path`, authorize `auth.uid()`, and receive minimum grants.
- No current route, dependency, migration, worker, cron, or environment contract supports uploaded musical media.

## Local validation architecture

`npm run supabase:start` starts database-only validation. `npm run supabase:start:auth` supports the default local browser suite without Storage or Edge Runtime. `npm run supabase:start:storage` is reserved for avatar-specific flows. `npm run check:midi-only` statically prevents legacy musical-media infrastructure from returning.
