# OpenMIDI MVP roadmap

Status: Post-pivot MVP release path accepted; implementation not yet deployed
Current branch: `master` at or after the MIDI-only foundation merge
Hosted state: existing Supabase project reconciled through five migrations; Vercel deployment deferred

## Release target

The next milestone is an invite-only OpenMIDI beta deployed to Vercel. It must let users create and publish MIDI projects, contribute and fork, discover reusable MIDI patterns, understand musical changes, participate in one curated constraint challenge, earn challenge awards, and report beta problems without relying on uploaded musical media.

The product was previously named Jam Session. Current product documentation uses OpenMIDI. Frontend copy, repository/package metadata, OAuth branding, and deployment URLs remain transitional until RELEASE-01. Stable manifest engine IDs, database identifiers, migration history, and historical evidence are compatibility contracts and are not renamed incidentally.

## Completed foundation

| Capability                                                        | Status   |
| ----------------------------------------------------------------- | -------- |
| MIDI Studio creation, recording, arranging, playback, and export  | Complete |
| Conflict-safe workspaces and immutable project publication        | Complete |
| Contribution submission, owner review, and atomic acceptance      | Complete |
| Copy-on-write project forking, lineage, and attribution           | Complete |
| Public project discovery, preview, revision history, and profiles | Complete |
| Invite-only Auth, moderation, deletion, and avatar operations     | Complete |
| MIDI-only manifest v3, normalized schema, tests, and hosted reset | Complete |

These foundations remain active product behavior. Historical PR/OPT/MIDI/STUDIO/PIVOT plans explain how they were delivered but are not current sequencing authority.

## Delivery graph

```text
                         +-------------------------+
                         | DIFF-01 -> 02 -> 03     |
MIDI-only foundation ----+                         +----> LIB-01 -> 02 -> 03
                         | FEEDBACK-01             |                    |
                         +-------------------------+                    v
                                                        CHALLENGE-01 -> 02 -> 03
                                                                         |
                                                                         v
                                                                    BADGE-01
                                                                         |
                                                                         v
                                                      RELEASE-01 -> 02 -> 03
```

Semantic diffs and beta feedback may proceed in parallel because they have separate feature and schema ownership. The library follows the shared diff surface so pattern history can reuse it. Challenges follow the library so starters and reusable-pattern attribution are already proven. Badges follow authoritative challenge results. Product-wide rebranding and deployment happen after feature work to avoid repeated cross-app conflicts.

## Wave A — Understanding changes and learning from beta users

### DIFF-01 — Contribution comparison model and navigator

Replace category counts with musician-facing arrangement, track, clip, note, and lineage details for exact contribution-base comparisons.

Status: Ready from `local/implementation-plans/028-semantic-visual-diffs.md`, which is intentionally untracked and must be supplied to the worker locally.

### DIFF-02 — Read-only note overlay and paired audition

Add the accessible piano-roll overlay and mutually exclusive browser-local before/after playback without exposing editing controls or server audio.

Status: Planned; sequential after DIFF-01.

### DIFF-03 — Public project revision comparison

Add public parent-to-child revision comparison and close the shared project comparison surface. The later library reuses it for exact pattern-version comparisons.

Status: Planned; sequential after DIFF-02.

### FEEDBACK-01 — Beta feedback intake and administrator triage

Add one authenticated, rate-limited Postgres-backed flow for bug reports and suggestions plus a private administrator queue. Administrators can classify, mark handled, and delete irrelevant submissions. No attachments, automatic diagnostic collection, or GitHub API integration.

Status: Needs a detailed local implementation plan before a worker starts. May run in parallel with the DIFF program if file/schema ownership is declared explicitly.

## Wave B — Public MIDI library and saved clips

### LIB-01 — Explicit listing and searchable catalog

Add explicit CC BY 4.0 pattern-version listing/unlisting, derived musical metadata, safe public projections, and bounded search/filter contracts. Public project publication must not list every pattern automatically.

### LIB-02 — Discovery, preview, history, usage, and pattern diff

Add library browse/detail pages with deterministic preview, read-only notes, immutable version/lineage history, visual parent/source comparison, and public-project usage. Private project usage must never leak through counts or links.

### LIB-03 — Saved clips and Studio import

Add a private saved-pattern collection referencing exact immutable versions. Saving does not duplicate notes or transfer ownership. Users can import a saved or discovered version into a chosen private workspace; edits remain copy-on-write and preserve attribution.

Status: LIB-01 through LIB-03 require one detailed local library plan before implementation. They are sequential because each establishes contracts consumed by the next.

## Wave C — Curated constraint challenges

### CHALLENGE-01 — Versioned challenge lifecycle and admin creation

Add administrator-created draft/scheduled/open/voting/completed/cancelled challenges, immutable starter references, timestamps, judging configuration, and a versioned constraint contract.

The first constraint version supports:

- minimum, maximum, or exact track count;
- minimum, maximum, or exact distinct instrument count;
- allowed and required instrument presets/families;
- minimum, maximum, or exact BPM;
- exact time signature; and
- exact declared key.

### CHALLENGE-02 — Preflight, authoritative validation, and entries

Let users validate a private/current revision, receive per-rule observed-versus-required feedback, and submit or explicitly replace one exact immutable eligible revision before the deadline. Server/database authority revalidates submission; the client preflight is advisory.

### CHALLENGE-03 — Voting, official results, and moderation

Add a post-submission voting phase, randomized/rotated entry presentation, one mutable vote per eligible user/entry, no self-votes, hidden totals until close, Community Favorite calculation, administrator-recorded official placements, and challenge/entry/vote moderation.

Status: CHALLENGE-01 through CHALLENGE-03 require a detailed local challenge plan after LIB-03. User-created challenge hosting, cash prizes, and programmable rules remain out of scope.

## Wave D — Recognition

### BADGE-01 — Challenge achievements and profile awards

Add an extensible badge-definition catalog and immutable profile award records tied to exact challenge results, placements, recipients, and submitted revisions. Launch with generic Winner, Community Favorite, and configurable Top Placement badges. Challenge-specific artwork/definitions may be added later without schema redesign.

Status: Needs a detailed local plan after CHALLENGE-03 freezes result authority. XP, levels, streaks, and purchasable status remain deferred.

## Wave E — Release and deployment

### RELEASE-01 — OpenMIDI product/repository/frontend rename

After the GitHub repository is renamed, update user-facing copy, metadata, package/repository links, OAuth branding, environment examples, deployment names, and current documentation. Do not rename stable manifest engine IDs, database objects, or applied migrations without an explicit compatibility migration.

### RELEASE-02 — Seeded beta and release hardening

Seed several useful public projects, a curated MIDI-library set, and one scheduled/open challenge. Perform the final accessibility, authorization, moderation, empty/error/loading-state, responsive, usage-budget, and administrator runbook pass. Confirm feedback triage and invitations are usable before inviting testers.

### RELEASE-03 — Vercel deployment and production smoke

Configure Vercel against the retained hosted Supabase project, apply only reviewed pending migrations in order, configure exact site/OAuth callback URLs and secrets, deploy the avatar function if required, and run the production smoke path. Document rollback/disable procedures and verify that no musical Storage or source-audio infrastructure returns.

Status: Deployment remains explicitly unauthorized until the user starts RELEASE-03. Merging code never applies migrations or changes hosted configuration automatically.

## Release gates

The invite-only MVP beta is releasable only when:

- all DIFF, FEEDBACK, LIB, CHALLENGE, BADGE, and RELEASE slices are complete;
- the critical Studio, publication, contribution, fork, diff, library save/import, challenge submission, feedback, and administrator journeys pass;
- clean migrations, pgTAP/RLS tests, generated types, the MIDI-only static contract, and production build are green;
- public queries do not reveal private projects, saved collections, feedback, votes before close, or administrator data;
- beta content is seeded so discovery, library, and challenge pages are useful on day one;
- the hosted migration target and Vercel/OAuth configuration are verified without exposing secrets; and
- release and rollback runbooks name the exact production URL, commit, migrations, and operator checks.

## Scope held after release

Do not add generic likes, follows, comments, direct messages, XP/levels, daily challenge fragmentation, user-programmable rules, real-time collaboration, uploaded audio, samples/soundfonts, payments, native applications, or professional-DAW parity before the invite-only beta produces evidence that they are more valuable than improving the core create–reuse–challenge loop.
