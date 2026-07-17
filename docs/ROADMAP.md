# Jam Session roadmap

Status: MIDI-only foundation implemented through PIVOT-09
Hosted state: not rehearsed or cut over; PIVOT-10 requires explicit approval

## Current checkpoint

Jam Session now operates as an intentionally MIDI-only product. Manifest v3, the bundled Tone.js preset catalog/runtime, normalized pattern and arrangement persistence, Studio creation/editing/publication, contribution review/acceptance, forks, public discovery, moderation/deletion, avatar-only Storage, the clean migration baseline, deterministic seed, generated database types, and the focused local test path are implemented.

The pre-pivot PR 01–20, OPT-01–OPT-05, MIDI-01–MIDI-07, and STUDIO-01–STUDIO-06 sequence remains available in Git history and technical evidence. It is historical and superseded as a delivery plan; it does not describe current runtime or deployment requirements.

## Foundation sequence

| Slice    | Outcome                                                                           | Status                            |
| -------- | --------------------------------------------------------------------------------- | --------------------------------- |
| PIVOT-00 | Product, vocabulary, licensing, runtime, and ownership contract                   | Complete                          |
| PIVOT-01 | Manifest v3, canonicalization, hashing, and semantic-diff domain                  | Complete                          |
| PIVOT-02 | Versioned bundled synthesis presets and browser-local runtime/render              | Complete                          |
| PIVOT-03 | Transitional normalized MIDI schema and commands                                  | Complete                          |
| PIVOT-04 | Studio creation/edit/save/publication cutover                                     | Complete                          |
| PIVOT-05 | Contribution review/acceptance and fork cutover                                   | Complete                          |
| PIVOT-06 | Public project, preview, history, and attribution cutover                         | Complete                          |
| PIVOT-07 | Application legacy-audio removal                                                  | Complete                          |
| PIVOT-08 | Supabase legacy-audio infrastructure removal                                      | Complete                          |
| PIVOT-09 | Clean migration baseline, deterministic testing, and documentation reconciliation | Complete                          |
| PIVOT-10 | Fresh hosted Supabase rehearsal and cutover                                       | Blocked pending explicit approval |

PIVOT-10 may create or link a fresh hosted Supabase project, rehearse the clean baseline, configure hosted Auth/avatar Storage, and verify deployment ordering only after explicit authorization. No current repository milestone implies that approval.

## Post-foundation product sequence

### 1. Semantic visual diffs

Turn the existing deterministic semantic diff into the primary review surface: arrangement metadata, track and clip changes, selected pattern note changes, lineage, and accessible summaries. Preserve exact immutable versions and do not introduce automatic musical merging.

### 2. Public MIDI pattern library

Add explicit pattern listing, discovery metadata, read-only piano-roll preview, exact-version reuse, copy-on-write derivation, listing removal, and durable CC BY 4.0 attribution. Project publication alone must not silently list a pattern.

### 3. Constraint challenges

Add versioned structured rules, entries pointing to exact immutable project revisions, deterministic validation snapshots, and result/voting state outside revision history. Challenge work follows the public library so reuse and attribution semantics are already proven.

## Release gates

Every slice runs focused checks and `npm run check`. Schema work additionally requires one clean reset, `npm run db:check`, regenerated types, and RLS/transaction tests. Cross-feature browser work uses `npm run test:e2e:local`. Hosted mutations and Vercel changes remain outside ordinary implementation authority.
