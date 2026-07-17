# OpenMIDI MVP roadmap

Status: Post-pivot MVP release path accepted; implementation not yet deployed
Current branch: `master` at or after the MIDI-only foundation merge
Hosted state: existing Supabase project reconciled through seven migrations; Vercel deployment deferred

## Release target

The next milestone is an invite-only OpenMIDI beta deployed to Vercel. It must let users create and publish MIDI projects, contribute and fork, discover reusable MIDI patterns, understand musical changes, participate in one curated constraint challenge, earn challenge awards, and report beta problems without relying on uploaded musical media.

The product was previously named Jam Session. Current product documentation uses OpenMIDI. Frontend copy, repository/package metadata, OAuth branding, and deployment URLs remain transitional until RELEASE-01. Stable manifest engine IDs, database identifiers, migration history, and historical evidence are compatibility contracts and are not renamed incidentally.

## Completed foundation

| Capability                                                         | Status   |
| ------------------------------------------------------------------ | -------- |
| MIDI Studio creation, recording, arranging, playback, and export   | Complete |
| Conflict-safe workspaces and immutable project publication         | Complete |
| Contribution submission, owner review, and atomic acceptance       | Complete |
| Copy-on-write project forking, lineage, and attribution            | Complete |
| Public project discovery, preview, revision history, and profiles  | Complete |
| Authorized semantic visual diffs and browser-local paired audition | Complete |
| Invite-only Auth, moderation, deletion, and avatar operations      | Complete |
| MIDI-only manifest v3, normalized schema, tests, and hosted reset  | Complete |

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

Status: Complete. The shared display model and accessible navigator ship in the contribution review flow.

### DIFF-02 — Static read-only note overlay and paired audition

Add the accessible static piano-roll overlay using the landing's gold `+` Added, coral `~` Changed, and muted dashed `−` Removed language, plus mutually exclusive browser-local before/after playback. Animated transformation remains deferred.

Status: Complete. The shared static note overlay and mutually exclusive browser-local paired audition ship without editing or server audio.

### DIFF-03 — Authorized project revision-pair comparison

Let viewers select, swap, link, and compare any two revisions they are authorized to read within one project. Public visitors select only public revisions; private projects retain membership authorization. The library later reuses the surface for any two authorized versions in one pattern history.

Status: Complete. The canonical `/projects/[projectId]/revisions/compare?from=<revision-id>&to=<revision-id>` route reuses the shared DIFF surface for any bounded, same-project revision pair the current RLS-scoped viewer can read. The DIFF program is closed; the public MIDI library is the next sequential implementation program.

### FEEDBACK-01 — Beta feedback intake and administrator triage

Add one authenticated, rate-limited Postgres-backed flow for bug reports and suggestions plus a private administrator queue. Administrators can classify, mark handled, and delete irrelevant submissions. No attachments, automatic diagnostic collection, or GitHub API integration.

Status: Complete. Authenticated beta intake, serialized administrator triage commands, private reporting data, and focused authorization coverage are merged. Wave A is closed; LIB is next.

## Wave B — Public MIDI library and saved clips

This is the next sequential implementation program after DIFF. Begin with a dedicated reviewed LIB plan before implementing LIB-01.

### LIB-01 — Explicit listing and searchable catalog

Add explicit pattern-version listing/unlisting with two rights modes: **Commercial reuse permitted — CC BY 4.0** and **Reference only — reuse not granted**. Include derived musical metadata, safe public projections, bounded search/filter contracts, an All/commercially-reusable/reference-only Explore filter, external-credit snapshots, and a rights-classification/attestation gate. Expand the current CC-only public-pattern constraints and read policy through a reviewed forward migration: CC-licensed versions cannot be downgraded, while reference-only versions retain no reuse license and use a separate public-display attestation. Reference-only is not a cure for missing rights; uncertain-rights covers/recreations cannot enter either mode. Public project publication must not list every pattern automatically.

### LIB-02 — Discovery, preview, history, usage, and pattern diff

Add library browse/detail pages with deterministic preview, read-only notes, immutable version/lineage history, selection between any two versions in the same pattern history, prominent reuse-mode labels, visible external credits/rights terms, and public-project usage. Add **Report unoriginal or unauthorized work** with administrator hide/review/restore actions. Private project usage and reports must never leak through counts or links.

### LIB-03 — Saved clips and Studio import

Add a private saved-pattern collection referencing exact immutable commercially reusable versions. Saving does not duplicate notes or transfer ownership. Users can import a commercially reusable saved/discovered version into a chosen private workspace, fork it explicitly, or open it in the MIDI editor through an owned private copy-on-write draft. Reference-only listings remain preview/history surfaces and all reuse commands reject them authoritatively. All permitted reuse paths preserve platform lineage, license, and external credits.

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

Add a post-submission voting phase, randomized/rotated entry presentation, one mutable vote per eligible user/entry, no self-votes, hidden totals until close, Community Favorite calculation, administrator-recorded official placements, and challenge/entry/vote moderation. Surface the featured active challenge on the landing page and dashboard. Keep completed challenge pages permanently addressable with frozen rules, entries, leaderboard/rankings, and results.

Status: CHALLENGE-01 through CHALLENGE-03 require a detailed local challenge plan after LIB-03. User-created challenge hosting, cash prizes, and programmable rules remain out of scope.

## Wave D — Recognition

### BADGE-01 — Challenge achievements and profile awards

Add an extensible badge-definition catalog and immutable profile award records tied to exact challenge results, placements, recipients, and submitted revisions. Every displayed badge links to its completed challenge/result page. Launch with generic Winner, Community Favorite, and configurable Top Placement badges. Challenge-specific artwork/definitions may be added later without schema redesign.

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
- the critical Studio, publication, contribution, fork, diff, library rights filtering plus permitted save/import and denied reference-only reuse, challenge submission, feedback, and administrator journeys pass;
- clean migrations, pgTAP/RLS tests, generated types, the MIDI-only static contract, and production build are green;
- public queries do not reveal private projects, saved collections, feedback, votes before close, or administrator data;
- public-library rights gating, external credits, copyright reporting, and moderation-hide behavior are verified and the operator copyright/contact process is documented;
- beta content is seeded so discovery, library, and challenge pages are useful on day one;
- the hosted migration target and Vercel/OAuth configuration are verified without exposing secrets; and
- release and rollback runbooks name the exact production URL, commit, migrations, and operator checks.

## Scope held after release

Do not add generic likes, follows, comments, direct messages, XP/levels, daily challenge fragmentation, user-programmable rules, real-time collaboration, uploaded audio, samples/soundfonts, payments, native applications, or professional-DAW parity before the invite-only beta produces evidence that they are more valuable than improving the core create–reuse–challenge loop.
