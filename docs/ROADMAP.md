# OpenMIDI MVP roadmap

Status: Post-pivot MVP release path accepted; implementation not yet deployed
Current checkpoint: RELEASE-02 complete; RELEASE-03 deployment remains unauthorized
Hosted state: reviewed schema behavior is current; linked migration-ledger verification, hosted seed, provider configuration, and Vercel deployment are deferred

## Release target

The next milestone is an invite-only OpenMIDI beta deployed to Vercel. It must let users create and publish MIDI projects, contribute and fork, discover reusable MIDI patterns, understand musical changes, participate in one curated constraint challenge, earn challenge awards, and report beta problems without relying on uploaded musical media.

OpenMIDI is the sole prelaunch product and technical identity. RELEASE-01 removed the former working name and namespace from the current repository, including persisted engine identifiers, fixtures, local infrastructure names, and clean-baseline migration source. Git history retains archaeology; current runtime compatibility with prelaunch musical data is not required.

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

This sequential program is complete, and the retained hosted schema includes its four ordered forward changes. Their SQL Editor execution is not proof that every linked migration-history entry exists.

### LIB-01 — Explicit listing and searchable catalog

Add explicit pattern-version listing/unlisting with two rights modes: **Commercial reuse permitted — CC BY 4.0** and **Reference only — reuse not granted**. Include derived musical metadata, safe public projections, bounded search/filter contracts, an All/commercially-reusable/reference-only Explore filter, external-credit snapshots, and a rights-classification/attestation gate. Expand the current CC-only public-pattern constraints and read policy through a reviewed forward migration: CC-licensed versions cannot be downgraded, while reference-only versions retain no reuse license and use a separate public-display attestation. Reference-only is not a cure for missing rights; uncertain-rights covers/recreations cannot enter either mode. Public project publication must not list every pattern automatically.

Status: Complete. `/library` and `/library/manage` use the exact-version listing commands, safe 25-row keyset search projection, deterministic note facets, two rights filters, immutable external-credit snapshots, and exclusive browser-local preview. The retained hosted schema includes this slice; linked-ledger recording remains to be verified in RELEASE-03.

### LIB-02 — Discovery, preview, history, usage, and pattern diff

Add library browse/detail pages with deterministic preview, read-only notes, immutable version/lineage history, selection between any two versions in the same pattern history, prominent reuse-mode labels, visible external credits/rights terms, and public-project usage. Add **Report unoriginal or unauthorized work** with administrator hide/review/restore actions. Private project usage and reports must never leak through counts or links.

Status: Complete. Canonical listing detail now exposes exact identity, browser-local preview, read-only notes, a deterministic 100-version authorized history window, URL-selected shared DIFF comparison and paired audition (including explicit authorized versions outside that first window), separated platform lineage/external credits, public-project-only usage, private rights reports, and optimistic audited administrator hide/restore/resolve/dismiss actions with a fresh idempotency key per successful action. The retained hosted schema includes this slice; linked-ledger recording remains to be verified in RELEASE-03.

### LIB-03 — Saved clips and Studio import

Add a private saved-pattern collection referencing exact immutable commercially reusable versions. Saving does not duplicate notes or transfer ownership. Users can import a commercially reusable saved/discovered version into a chosen private workspace, fork it explicitly, or open it in the MIDI editor through an owned private copy-on-write draft. Reference-only listings remain preview/history surfaces and all reuse commands reject them authoritatively. All permitted reuse paths preserve platform lineage, license, and external credits.

Status: Complete. Private exact-version bookmarks, saved-clip preview/attribution, optimistic workspace import, explicit private copy-on-write forks, owned editor copies, and browser-local attributed MIDI export all enforce commercial reuse independently. Reference-only, hidden, deleted, unreadable, incompatible, and stale-lock sources are rejected authoritatively. Existing valid saved/project references and attribution survive creator unlisting. The retained hosted schema includes all four LIB changes; linked-ledger recording remains to be verified in RELEASE-03.

## Wave C — Curated constraint challenges

### CHALLENGE-01 — Versioned challenge lifecycle and admin creation

Add administrator-created draft/scheduled/open/voting/completed/cancelled challenges, immutable starter references, timestamps, judging configuration, and a versioned constraint contract.

Challenge content and constraints are immutable version records. Draft revision appends a version, entries later pin one exact version, and scheduled/open/voting phases derive from its frozen UTC boundaries without a lifecycle cron job. Completion and cancellation remain explicit audited administrator commands.

The first constraint version supports:

- minimum, maximum, or exact track count;
- minimum, maximum, or exact distinct instrument count;
- allowed and required instrument presets/families;
- minimum, maximum, or exact BPM;
- exact time signature; and
- exact declared key.

Status: Complete. Administrators can create and append draft versions, publish or cancel through idempotent optimistic commands, and inspect private projections. Anonymous visitors receive only bounded published/cancelled-safe index and canonical detail projections. Constraint schema v1 canonicalizes deterministically in TypeScript and Postgres, and scheduled/open/voting labels derive from frozen UTC boundaries without cron. The retained hosted schema includes this slice; linked-ledger recording remains to be verified in RELEASE-03.

### CHALLENGE-02 — Preflight, authoritative validation, and entries

Let users validate a private/current revision, receive per-rule observed-versus-required feedback, and submit or explicitly replace one exact immutable eligible revision before the deadline. Server/database authority revalidates submission; the client preflight is advisory.

Status: Complete. Active project owners can preflight current immutable revisions with complete observed-versus-required feedback, then explicitly attest challenge-scoped display and submit or replace one exact entry. Postgres independently extracts normalized facts, enforces constraint-v1 eligibility, deadline/current-version/current-revision authority, idempotency, and replacement contention. Pre-voting projections expose no entry identities or counts; voting/completed projections and browser-local previews are challenge-scoped and do not publish private projects, enable downloads, or grant reuse. The retained hosted schema includes this slice; linked-ledger recording remains to be verified in RELEASE-03.

### CHALLENGE-03 — Voting, official results, and moderation

Add a post-submission voting phase, randomized/rotated entry presentation, one mutable vote per eligible user/entry, no self-votes, hidden totals until close, Community Favorite calculation, administrator-recorded official placements, and challenge/entry/vote moderation. Surface the featured active challenge on the landing page and dashboard. Keep completed challenge pages permanently addressable with frozen rules, entries, leaderboard/rankings, and results.

Status: Complete. Private one-logical-vote authority, deterministic hourly rotation, report-only intake, optimistic audited challenge/entry/vote moderation, database-computed favorite ties, immutable complete result corrections, permanent completed projections, and canonical featured selection/fallback now ship together. Landing and dashboard consume the same signed-out-safe featured projection. The retained hosted schema includes all three CHALLENGE changes, while linked-ledger recording remains to be verified in RELEASE-03; user-created challenge hosting, cash prizes, and programmable rules remain out of scope.

## Wave D — Recognition

### BADGE-01 — Challenge achievements and profile awards

Add an extensible badge-definition catalog and immutable profile award records tied to exact challenge results, placements, recipients, and submitted revisions. Every displayed badge links to its completed challenge/result page. Launch with generic Winner, Community Favorite, and configurable Top Placement badges. Challenge-specific artwork/definitions may be added later without schema redesign.

Status: Complete. Three stable badge identities point to append-only versioned presentations, while immutable awards snapshot the exact recipient, result, entry, revision, badge version, and display context. Initial finalization and corrections issue the complete Winner, all Community Favorite ties, and remaining Top Placement set transactionally from normalized current-result authority. Superseded award rows remain private evidence; the bounded profile projection shows only current visible results with canonical challenge/result/entry links. The retained hosted schema includes the BADGE change, while linked-ledger recording remains to be verified in RELEASE-03; XP, levels, streaks, participation awards, user-created badges, uploads, and purchasable status remain deferred.

## Wave E — Release and deployment

### RELEASE-01 — OpenMIDI product/repository/frontend rename

Complete the OpenMIDI identity reset across user-facing copy, metadata, package/repository links, environment examples, runtime/browser namespaces, persisted manifest/diff engine identifiers, test actors/fixtures, local infrastructure identity, current documentation, and clean-baseline migration source. Add a reviewed forward reconciliation migration for the retained hosted project rather than requiring a new Supabase project. Git history remains the historical record.

Status: Complete. Product copy, package/repository setup, runtime and browser namespaces, manifest/diff/export identity, tests, clean migration source, local Supabase identity, and documentation now use only OpenMIDI. The no-allowlist tracked-text contract runs in `npm run check`. The retained hosted schema includes the corrected reconciliation behavior, and the authorized SQL Editor execution cleared disposable musical state while preserving identity/operator/feedback/avatar/catalog state. RELEASE-03 must verify whether that repository version is present in the linked ledger and reconcile history through a reviewed non-schema procedure if it is absent; the destructive cleanup itself must not be repeated.

### RELEASE-02 — Seeded beta and release hardening

Seed several useful public projects, a curated MIDI-library set, and one scheduled/open challenge. Perform the final accessibility, authorization, moderation, empty/error/loading-state, responsive, usage-budget, and administrator runbook pass. Confirm feedback triage and invitations are usable before inviting testers.

Status: Complete. Three compact original projects, seven reviewed manifest-v3 pattern fixtures spanning both rights modes, one approachable curated challenge, a dry-run-first idempotent actor-owned importer, critical-state hardening, and operator runbooks ship without hosted mutation. Pocket Circuit is the CC BY forkable project and embeds only commercial-reuse patterns; the projects containing reference-only patterns are all-rights-reserved.

### RELEASE-03 — Vercel deployment and production smoke

Verify the retained hosted schema against the repository and inspect the linked migration ledger. If SQL Editor executions are missing from history, reconcile the ledger through a separately reviewed, authorized, non-schema procedure before any later migration. Then configure Vercel against the retained hosted Supabase project, configure exact site/OAuth callback URLs and secrets, run the approved beta seed dry run/import, deploy the avatar function if required, and run the production smoke path. Do not blindly replay schema SQL or repeat the destructive RELEASE-01 cleanup. Document rollback/disable procedures and verify that no musical Storage or source-audio infrastructure returns.

Status: Ready after RELEASE-02 but explicitly unauthorized until the user starts RELEASE-03 and supplies the production-origin/operator decisions named by the release plan. RELEASE-03 owns provider configuration, approved hosted seed import, deployment, and production smoke only. Merging code never changes hosted data or configuration automatically.

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
