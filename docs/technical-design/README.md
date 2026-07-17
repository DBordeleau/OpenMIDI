# OpenMIDI technical design

Status: MIDI-only foundation complete on `master`; hosted schema reconciled
Last updated: 2026-07-17

This document set turns the [product requirements](../PRD.md) into implementation contracts. The tracked [roadmap](../ROADMAP.md) owns delivery order, the [pivot contract](midi-only-pivot-contract.md) freezes manifest-v3 vocabulary and invariants, and the [brand guide](../design/brand.md) owns user-facing presentation.

| Document                                                              | Authority                                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [01-system-architecture.md](01-system-architecture.md)                | Runtime boundaries, workflows, security, and local/hosted separation               |
| [02-data-model.md](02-data-model.md)                                  | Clean baseline schema, RLS, immutable history, seed, and avatar Storage            |
| [03-delivery-plan.md](03-delivery-plan.md)                            | Verification gates, sequencing, and hosted cutover boundary                        |
| [decisions/README.md](decisions/README.md)                            | Stable accepted and superseded architectural decisions                             |
| [midi-only-pivot-contract.md](midi-only-pivot-contract.md)            | Manifest v3, patterns, arrangements, presets, attribution, and deferred extensions |
| [studio-forward-refactor-plan.md](../studio-forward-refactor-plan.md) | Historical Studio refactor record only                                             |

## Current implementation pulse

PIVOT-01 through PIVOT-10 and the administrator-invitation reconciliation are implemented on `master`:

- canonical manifest v3, hashing, normalized round trips, and deterministic semantic diff;
- 24 versioned sample-free Tone.js presets and browser-local playback/import/export/render;
- mutable conflict-safe workspaces with bounded Postgres recovery snapshots;
- immutable MIDI pattern versions, arrangement versions, project revisions, and contribution versions;
- Studio create/edit/save/reload/publish/preview and local downloads;
- exact contribution review/acceptance, attribution snapshots, and fork lineage;
- public project discovery/history/preview and safe profile/dashboard navigation;
- bounded semantic comparison for contribution versions and any two authorized same-project revisions, with a static accessible note overlay and mutually exclusive browser-local audition;
- reporting, admin moderation, holds, recoverable deletion, retention, and avatar processing;
- four reviewed clean baseline migrations plus administrator-invitation and two beta-feedback forward migrations, deterministic MIDI-only seed, current generated types, and pgTAP coverage; and
- an Auth/Postgres-only default browser suite plus enforceable zero-legacy-audio static checks.

Supabase Storage contains only private avatar originals and public avatar derivatives. Musical state and recovery snapshots live in Postgres. Tone.js and browser audio APIs remain inside the client-only MIDI runtime. The repository does not require an audio worker, scheduled job, musical bucket, or musical-media secret.

## Historical evidence

The PR 01–20, OPT-01–OPT-05, MIDI-01–MIDI-07, STUDIO-01–STUDIO-06, and UX sequencing remains in Git history, ADRs, the Studio-forward record, and `evidence/`. It explains how the system evolved but is superseded as current behavior and future delivery authority. Do not copy compatibility requirements from those records into new implementation.

## Next work and hosted state

Wave A is complete. The three-slice semantic visual-diff program gives contribution owners and authorized project viewers the same bounded display model, static note overlay, text equivalents, attribution, and browser-local paired audition; FEEDBACK-01 provides authenticated intake and private administrator triage. The rights-gated public MIDI library and saved clips are the next implementation program. Curated challenges, linked challenge awards, and release hardening follow the library. PIVOT-10 completed the destructive same-project hosted rebaseline while retaining the existing project reference/API configuration. The administrator-invitation migration `20260717142701` and both beta-feedback migrations were subsequently applied to that retained project, producing a seven-migration hosted history. DIFF-03 adds no migration, future hosted mutation still requires explicit operational authority, and Vercel deployment remains deferred to RELEASE-03.

## Global invariants

- Normalized Postgres rows are queryable authority; validated manifest-v3 JSON and hashes are portable snapshots.
- Published and submitted history is immutable. Workspace saves use optimistic concurrency.
- Acceptance appends one revision transactionally and never performs automatic musical merging.
- Forks and reuse preserve exact source revision/pattern versions, creator snapshots, and CC BY 4.0 attribution. Reference-only library listings grant no reuse and cannot enter those command paths.
- Public layouts are Auth-independent; authorization lives in verified identity, services, commands, and RLS.
- Security-definer functions pin `search_path`, authorize the caller, and expose minimum execute grants.
- Profile avatars are the only user-provided Storage media.
- Hosted mutation requires explicit task authority.
