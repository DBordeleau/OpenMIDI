# MIDI-only pivot contract

Status: Accepted target contract for PIVOT-01–PIVOT-10
Date: 2026-07-16
Implementation state: Implemented and hosted-rehearsed through PIVOT-10; Vercel deployment deferred

## Purpose

This document froze the shared vocabulary and authority boundaries used by the MIDI-only pivot. PIVOT-09 reconciled the repository to this model; historical transition notes below remain useful for ownership archaeology.

The replacement [PRD](../PRD.md) is product authority. The [pivot roadmap](../ROADMAP.md) owns sequence. ADR-010 through ADR-014 in the [decision index](decisions/README.md) own stable architectural decisions.

## Product boundary

Jam Session accepts, stores, versions, previews, and collaborates on structured MIDI only.

The target product has no source-audio upload, stem/sample/vocal recording, waveform editing, signed audio delivery, or server-stored audio preview. MIDI synthesis may produce an ephemeral browser playback signal and a local downloadable audio render. That render is never uploaded, versioned, shared, or authoritative.

Profile avatars remain the only planned user-provided media in Supabase Storage. Their existing private-original/public-derived authorization boundary remains separate from the musical domain.

## Canonical vocabulary

| Term                 | Meaning                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Project              | Long-lived public/private musical identity, metadata, ownership, current revision, and fork lineage    |
| Workspace            | Mutable private arrangement draft with optimistic concurrency and bounded recovery snapshots           |
| Arrangement version  | One immutable complete MIDI arrangement snapshot shared by project revisions and contribution versions |
| Track                | Ordered instrument/mixer lane inside a workspace or arrangement                                        |
| Clip                 | Stable placement of one immutable pattern version on a track timeline                                  |
| MIDI pattern         | Reusable musical identity formerly called a MIDI stem                                                  |
| MIDI pattern version | Immutable note content, creator snapshot, content hash, and parent/source lineage                      |
| MIDI note            | Stable note ID, start tick, duration ticks, pitch, and velocity                                        |
| Project revision     | Immutable published wrapper pointing to one arrangement version and its parent project revision        |
| Contribution version | Immutable proposed wrapper pointing to one arrangement version and an exact base project revision      |
| Revision attribution | Immutable publisher or accepted-contributor snapshot for a project revision                            |
| Preset version       | Immutable deterministic synthesized instrument definition referenced by exact ID/version               |

“Stem” is not a target domain term. During transition it may appear only in historical evidence, explicitly temporary compatibility code, or removal inventory references.

## Authority model

### Mutable workspaces

Target SQL names:

- `public.workspaces`
- `public.workspace_tracks`
- `public.workspace_clips`
- `private.workspace_snapshots`

Workspace tracks contain:

- `workspace_id`
- stable `track_id`
- `sort_order`
- `name`
- exact `preset_id` and `preset_version`
- `gain_db`, `pan`, `muted`, and `soloed`

Workspace clips contain:

- `workspace_id`
- `track_id`
- stable `clip_id`
- exact `midi_pattern_version_id`
- `start_tick`
- `duration_ticks`
- `source_start_tick`
- `loop`

Workspace snapshots are bounded JSONB recovery records in Postgres. They are not Storage assets, published history, or a second editable authority.

### Reusable immutable MIDI patterns

Target SQL names:

- `public.midi_patterns`
- `public.midi_pattern_versions`
- `public.midi_pattern_notes`

`midi_patterns` own reusable identity, owner, lifecycle, public-library eligibility, and optional source-pattern identity.

`midi_pattern_versions` are immutable and contain:

- pattern/version identity and monotonically increasing version number;
- creator profile ID and immutable creator credit-name snapshot;
- optional exact parent pattern-version ID;
- canonical content SHA-256 and note count;
- PPQ and bounded duration ticks;
- creation timestamp;
- exact reuse-license code/version when publicly reusable.

`midi_pattern_notes` normalize canonical note content:

- pattern-version ID;
- stable note ID;
- start tick;
- duration ticks;
- MIDI pitch `0..127` constrained further by the selected preset at application validation;
- velocity `1..127`.

Editing is copy-on-write. An existing pattern version is never updated. Repeating music creates another clip reference; it does not require another track or duplicate the pattern-version notes. Deriving/editing reusable work creates a new immutable pattern version with exact lineage.

### Immutable arrangements

Target SQL names:

- `public.arrangement_versions`
- `public.arrangement_tracks`
- `public.arrangement_clips`

An arrangement version contains:

- immutable arrangement ID;
- owning project ID;
- creator/publisher actor ID;
- manifest version, engine ID/version, canonical manifest JSONB, and SHA-256;
- tempo, time signature, key metadata, PPQ, and duration ticks;
- creation timestamp.

Arrangement tracks and clips use the same musical fields as workspace tracks/clips and are immutable projections of the validated manifest.

Both wrappers reference this one snapshot type:

- `public.project_revisions.arrangement_version_id`
- `public.contribution_versions.arrangement_version_id`

Project revisions and contribution versions do not own duplicate normalized track/clip tables in the target baseline. This common boundary lets publication, review, semantic diffs, previews, exports, challenge validation, and forks compare or consume the same exact immutable shape.

### Manifest v3

The target TypeScript discriminant is `manifestVersion: 3`. The target engine ID is `jam-session-midi`; the initial engine version is `jam-session-midi-3_tone-15.1.22_presets-1`. PIVOT-01 and PIVOT-02 must both use this exact value. A later Tone or preset-catalog change requires a new engine version and deliberate compatibility fixtures.

Manifest v3 contains only:

```text
manifestVersion
engine
engineVersion
projectId
workspaceId (workspace snapshots only)
tempoBpm
timeSignature { numerator, denominator }
musicalKey
ppq
durationTicks
tracks[]
  trackId
  sortOrder
  name
  presetId
  presetVersion
  gainDb
  pan
  muted
  soloed
  clips[]
    clipId
    midiPatternVersionId
    startTick
    durationTicks
    sourceStartTick
    loop
```

The manifest contains no audio union, asset/bucket/path/URL, waveform, media metadata, millisecond trim/position, compatibility mode, draft pattern ID, live editor object, or embedded note duplication.

Normalized rows are the queryable domain authority after a transaction succeeds. The immutable manifest and hash are the portable deterministic snapshot. One database command validates the complete input, resolves exact immutable pattern/preset versions, and writes snapshot plus projections atomically. Round-trip fixtures must prove that normalized rows reconstruct the same canonical manifest.

### Attribution and licensing

Remove the target need for both `revision_track_credits` and `revision_midi_track_credits`.

- Pattern versions preserve creator identity, creator-name snapshot, parent/source lineage, and reuse license.
- Arrangement clips reference exact pattern versions.
- `revision_attributions` continues to snapshot publisher and accepted contributor.
- A bounded flattened arrangement credit summary may be stored as a projection for display; it is not independent authority and cannot erase pattern lineage.
- Profile rename/deletion never rewrites immutable creator or revision attribution snapshots.

The first public reuse license is Creative Commons Attribution 4.0 International (`CC-BY-4.0`, canonical URL `https://creativecommons.org/licenses/by/4.0/`). Public remixable projects/patterns require explicit rights attestation. Private drafts have no public reuse grant. Export packages include the MIDI file, attribution data, and license notice because Standard MIDI metadata alone is insufficient.

## Semantic diff contract

The PIVOT-01 pure diff engine compares any two immutable arrangement versions. Its versioned deterministic output covers:

- tempo, meter, key, and duration;
- tracks added, removed, renamed, reordered, or changed in preset/mixer state;
- clips added, removed, moved, resized, looped, or changed to another pattern version;
- notes added, removed, moved, resized, repitched, or velocity-changed;
- pattern source/parent lineage changes.

Publication may persist a bounded summary and algorithm version. Detailed selected-track/clip note changes may be computed on demand. No language model writes authoritative summaries, and the pivot does not introduce automatic musical merging.

## Instrument contract

PIVOT-02 implements approximately 20–24 curated Tone.js synthesis presets across:

- drums/percussion;
- basses;
- keys;
- leads;
- pads/strings;
- plucks/bells/textures.

Preset catalog `1` contains these 24 stable IDs; PIVOT-02 may tune their sound and metadata but must not rename, add, or remove IDs without returning a contract change to the integration owner:

| Family                | Preset IDs                                                   |
| --------------------- | ------------------------------------------------------------ |
| Drums/percussion      | `drum-machine`, `electro-kit`, `lofi-kit`, `percussion-rack` |
| Basses                | `sub-bass`, `analog-bass`, `fm-bass`, `pluck-bass`           |
| Keys                  | `warm-keys`, `electric-keys`, `organ`, `glass-keys`          |
| Leads                 | `saw-lead`, `square-lead`, `fm-lead`, `soft-lead`            |
| Pads/strings          | `warm-pad`, `air-pad`, `string-pad`, `choir-pad`             |
| Plucks/bells/textures | `muted-pluck`, `bright-pluck`, `bell`, `mallet`              |

Every preset version exposes stable ID/version, family, display name/description, pitch range, polyphony bound, engine version, parameter schema, and active/deprecated state. Published arrangements pin exact versions. Existing versions are never silently changed.

No preset may depend on a sample, soundfont, remote audio request, user-supplied synth graph, or Supabase Storage object. Imported General MIDI programs map deterministically to the closest supported family/preset without claiming full 128-program timbre parity.

## Deferred extension points

### Challenges

The pivot creates no challenge/vote/result tables. The model must later support:

- challenge entries pointing to exact immutable project revisions;
- versioned structured constraint definitions;
- immutable validation snapshots binding rule version, checker version, and arrangement version;
- preset-family/pattern/note queries without parsing opaque editor state;
- result/voting state outside immutable project revisions.

### Public MIDI pattern library

The pattern model must later support:

- explicit public listing separate from project publication;
- derived searchable musical metadata;
- read-only piano-roll preview;
- exact version import and copy-on-write derivation;
- durable creator/source lineage and CC BY attribution;
- listing removal without rewriting already published revisions.

## Preserved implementation boundaries

- Next.js App Router, strict TypeScript, Tailwind, Motion, Supabase Auth/Postgres, and Vercel remain selected.
- Studio remains client-only and lazy; Tone.js and browser audio APIs stay inside a documented browser-only MIDI runtime boundary.
- Public layouts remain Auth-independent; authorization remains in server/data/RLS boundaries.
- Published revisions and submitted contribution versions remain immutable.
- Workspace saves remain optimistic and conflict-safe.
- Contribution acceptance remains atomic and stale-base aware.
- Forks retain exact source project/revision lineage and copy-on-write immutable musical references.
- Profile avatars retain private-original/public-derived Storage behavior.

## Removed target boundaries

The target application has no Waveform Playlist dependency, composite audio/MIDI adapter, manifest v1/v2 compatibility promise, audio source asset, waveform peak, source verification worker, source-admission capability, audio quota, source retention operator, stem download, or source-audio route.

Historical evidence remains in Git/docs and is not current implementation authority.

## Parallel implementation ownership

- PIVOT-01 owns manifest/domain/diff TypeScript and deterministic fixtures.
- PIVOT-02 owns preset definitions, Tone voices, scheduling/local-render tests, and dependency changes required by instruments.
- PIVOT-03 owns transitional SQL/RLS/commands, pgTAP, repositories required to expose the new model, and generated database types.

All three branch from the same PIVOT-00 merge commit. A worker needing to change another slice's contract must report the need rather than editing that owner's files concurrently.
