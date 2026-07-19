# OpenMIDI — Product Requirements Document

Status: Approved post-pivot MIDI-only MVP; invite-only beta deployed

Last updated: 2026-07-19

Supersedes: The collaboration-first, MIDI-plus-legacy-audio MVP definition

Product identity: OpenMIDI is the sole prelaunch product and technical namespace. RELEASE-01 removed the former working identity from the current repository, including persisted engine identifiers and clean-baseline migration source. The corrected forward reconciliation has been applied to the retained hosted Supabase project and cleared disposable musical domain data without changing the retained project identity.

## Product summary

OpenMIDI is a public playground for making, remixing, and competing with MIDI music.

Bedroom producers and casual musicians create complete arrangements in a browser Studio, publish meaningful musical revisions, fork each other's work, reuse credited MIDI clips, and enter playful composition challenges with machine-checkable constraints. OpenMIDI borrows the best ideas from open-source development—version history, diffs, forks, contributions, and durable attribution—without requiring users to understand Git or own a professional DAW.

The MVP is MIDI-only. It does not accept, store, arrange, preview, or distribute uploaded source-audio files.

## Implementation checkpoint

| Capability                                                       | Current repository state |
| ---------------------------------------------------------------- | ------------------------ |
| MIDI Studio, recording, arranging, save, publication, and export | Complete                 |
| Contributions, owner review, acceptance, and attribution         | Complete                 |
| Copy-on-write project forks and lineage                          | Complete                 |
| Public project discovery, preview, history, profiles, moderation | Complete                 |
| Visual project/contribution/pattern comparison                   | Complete                 |
| Public MIDI library and saved clip collection                    | Complete                 |
| Curated challenges, validation, voting, and results              | Complete                 |
| Challenge achievements and profile badges                        | Complete                 |
| Beta bug/suggestion intake and administrator triage              | Complete                 |
| OpenMIDI frontend/repository rename                              | Complete: RELEASE-01     |
| Seeded-beta hardening                                            | Complete: RELEASE-02     |
| Hosted rollout, Vercel deployment, and production smoke          | Complete: RELEASE-03     |

“Complete” describes deployed invite-only beta behavior unless a row explicitly names a deferred follow-up. OpenMIDI is live at `https://open-midi.vercel.app/`.

## Product thesis

Most beginner and hobbyist music tools optimize for solitary creation or professional production. They give users a blank canvas, then leave them to find inspiration, material, feedback, and an audience elsewhere.

OpenMIDI should optimize for a different moment:

> “I want to make something fun, see how other people would change it, and have a reason to come back tomorrow.”

MIDI makes that experience unusually tractable:

- projects remain lightweight enough for a free prototype;
- every note, clip, instrument, tempo, and arrangement decision is structured data;
- revisions can explain what musically changed instead of only showing version numbers;
- constraints can be checked automatically;
- clips can be searched, reused, transformed, and credited without copying large media files;
- every project can play in the browser with deterministic versioned instruments.

The product is not primarily a collaborator-matching service, cloud drive, audio-hosting platform, or simplified professional DAW. It is a creative community built around playable MIDI source, remixable history, and structured challenges.

## Target users

### Primary audience

#### Bedroom producers

People who make beats and electronic music at home, enjoy experimenting with instruments and arrangements, and want a lower-friction way to publish ideas, remix others, and receive recognition.

#### Casual and hobbyist musicians

People who enjoy composing but do not need professional recording, mixing, or release workflows. They value immediate playback, prompts, constraints, and approachable tools over deep DAW parity.

#### Music-production learners

People learning rhythm, harmony, arrangement, and MIDI sequencing who benefit from inspecting how projects evolved, modifying reusable parts, and composing within understandable constraints.

### Secondary audience

- Small online beat-making and game-music communities
- Content creators who want lightweight, reusable MIDI ideas
- Experienced producers who enjoy quick challenges, teaching through remixing, or publishing source material

### Explicitly not the initial audience

- Bands exchanging multitrack recordings
- Vocalists or instrumentalists collaborating through recorded audio
- Professional engineers managing masters, stems, and client deliverables
- Musicians seeking full desktop-DAW replacement or plugin hosting

## User needs

OpenMIDI must help users:

1. Start creating without facing an empty professional DAW.
2. Finish small musical ideas by giving them prompts, boundaries, and deadlines.
3. Understand how another producer constructed and changed a piece.
4. Remix and reuse musical material without losing its origin or creator credit.
5. Receive lightweight recognition for creative work without needing an existing following.
6. Discover playable material and active creative events instead of browsing a passive feed.
7. Create and participate without uploading large files or installing desktop software.

## Product principles

### Play before configuration

The fastest route from arrival to value is hearing something and changing it. Avoid setup-heavy creation flows, blank dashboards, and forms that precede the Studio unnecessarily.

### Constraints create momentum

Challenges should provide useful creative boundaries, not imitate a generic popularity contest. A good constraint changes how someone composes and is clear enough to verify.

### Musical changes should be legible

“Revision 4” is not enough. OpenMIDI should explain which tracks, clips, notes, instruments, tempo, meter, key, and mixer values changed.

### Reuse should preserve provenance

Forking a project or importing a public MIDI clip must retain durable lineage and attribution automatically. Credit should not depend on copy-and-pasted text.

### Lightweight competition, not a grind economy

Recognition should reward completed creative work. The MVP may award challenge winner, Community Favorite, finalist, and participation badges. It will not launch with XP, levels, streak pressure, loot mechanics, or purchasable status.

### Public by purpose, private while drafting

Published projects, challenge entries, revision summaries, and explicitly published library clips are designed for public discovery. Workspaces and unfinished drafts remain private. Users must make an explicit publish or submit decision before work becomes public.

### MIDI-only means MIDI-only

Do not preserve a hidden product promise that source-audio uploads will return soon. Any future audio support requires a new product decision, sustainable storage and bandwidth model, and a replacement PRD/architecture decision.

## Goals

- Make it possible to create and publish a playable multi-track MIDI project entirely in the browser.
- Give users repeatable reasons to create through curated constraint challenges.
- Make forks, contributions, and revisions understandable through semantic musical diffs.
- Turn public MIDI material into a useful, searchable, automatically credited creative library.
- Let users save exact public pattern versions and move them into a Studio project with minimal friction.
- Establish a healthy creation-remix-vote-return loop before investing in broad social mechanics.
- Give beta users a safe feedback channel and administrators a bounded triage queue.
- Keep the prototype viable on a $0 infrastructure budget by avoiding uploaded source audio.
- Preserve deterministic playback, immutable published history, attribution, and moderation boundaries.
- Reach a seeded, invite-only Vercel deployment with verified hosted configuration and rollback instructions.

## Non-goals

The MVP will not include:

- Source-audio, stem, sample, vocal, or microphone uploads
- Audio recording, waveform editing, time stretching, mastering, or server-stored audio exports/previews
- Professional DAW parity
- VST, Audio Unit, AAX, or other third-party plugin hosting
- Proprietary DAW project import or export
- Real-time multi-user editing or live collaborative sessions
- Automatic merging of divergent musical changes
- User-created challenge rule programming
- Cash prizes, entry fees, betting, or paid competition placement
- XP, levels, daily streak penalties, or an economy of virtual goods
- Direct messages, generic follower feeds, or broad social networking
- Algorithmic collaborator matchmaking
- AI-generated music, AI judging, or generative composition
- Music distribution to streaming platforms
- Rights-dispute resolution or a commercial MIDI marketplace
- Native desktop or mobile applications
- Feedback file attachments, automatic diagnostic-log collection, or automatic GitHub issue creation

Standard MIDI File import and export remain supported. The browser Studio should be capable and enjoyable, but it is not intended to replace Ableton Live, FL Studio, Logic, REAPER, or another professional DAW.

Users may render a deterministic local audio file from MIDI synthesis as a browser-only download. That file is never uploaded, versioned, shared, or treated as project authority.

## MVP product loop

The primary loop is:

1. A user discovers an active challenge, interesting project, revision, or reusable clip.
2. They listen immediately in the browser.
3. They create from a blank project, fork a project, import a clip, or open a challenge starter.
4. They compose and arrange in the Studio.
5. They publish a revision or submit an immutable challenge entry.
6. OpenMIDI shows what changed and preserves every source relationship and credit.
7. Other users listen, vote during the appropriate phase, fork, contribute, or reuse published material.
8. Results, badges, feedback, and new challenges give the creator a reason to return.

The MVP succeeds when users repeatedly move through this loop. Passive listening and raw account growth are secondary.

## Core MVP features

### 1. MIDI Studio and piano roll

The existing Studio remains the core creation surface.

Users can:

- Start from an empty MIDI project or an eligible project/challenge starter.
- Create multiple instrument and drum tracks.
- Select deterministic, versioned built-in presets.
- Draw, move, resize, duplicate, delete, and velocity-edit notes.
- Select and transform groups of notes.
- Record notes from the on-screen keyboard and computer keyboard.
- Use supported Web MIDI input as a progressive enhancement.
- Arrange multiple clips on a continuous timeline.
- Copy, paste, loop, split, move, and duplicate compatible clips.
- Adjust tempo, meter, project key metadata, gain, pan, mute, and solo.
- Save private drafts with conflict-safe autosave.
- Publish an immutable revision.
- Import and export the supported Standard MIDI File subset.
- Render a local synthesized audio download without uploading it to OpenMIDI.

The Studio must open quickly without network-bound media hydration. Playback uses deterministic versioned instrument definitions so a published revision remains reproducible.

#### MVP quality bar

- A new user can create their first note without navigating away from the Studio.
- Empty-track and add-track actions are visible and understandable.
- Playback, playhead, note events, mixer changes, and visualization remain synchronized.
- Keyboard-only creation and editing paths remain usable.
- A published project can be reconstructed from structured OpenMIDI data without live editor objects.

### 2. Projects, revisions, contributions, and forks

Projects are public containers for evolving MIDI arrangements. Private workspaces hold drafts; published revisions are immutable.

Users can:

- Create, title, describe, tag, and publish a MIDI project.
- Browse its revision history.
- Fork an exact revision and continue independently.
- Propose a contribution derived from an exact project revision.
- Review, accept, request changes to, or reject a contribution.
- Preserve lineage when an accepted contribution creates a new project revision.
- Export a revision as a supported Standard MIDI File.

Projects should default to private while empty or unpublished. Publishing makes the selected immutable revision discoverable unless moderation has hidden it.

#### Semantic revision summaries

Every published revision and submitted contribution must have a deterministic structured change summary relative to its parent/base version. It should report applicable changes such as:

- tracks added, removed, renamed, or reordered;
- clips added, removed, moved, resized, looped, or reassigned;
- notes added, removed, moved, resized, or velocity-changed;
- instrument preset changes;
- tempo, meter, key metadata, duration, gain, pan, mute, or solo changes.

Summaries must be computed from canonical structured data, not supplied by a language model. Users may add an optional human revision message.

#### Visual diff

The MVP includes bounded comparisons for:

- any two revisions the viewer is authorized to read within the same project;
- a submitted contribution and its exact base revision; and
- any two versions the viewer is authorized to read within the same MIDI pattern/clip history.

Each comparison provides:

- before/after note overlays in the piano roll;
- clear added, removed, and changed states that do not rely on color alone;
- a track/clip navigator linked to the structured summary;
- readable metadata, instrument, placement, lineage, and note-change details;
- playback of either immutable side;
- no attempt to automatically merge the two versions.

The default comparison may use a revision/version and its exact parent, but users can select non-adjacent versions, swap sides, and share/reload the exact authorized pair. The pair must belong to one project or one pattern history; cross-project, cross-pattern, three-way, notation, and automatic-merge comparisons are deferred.

The note overlay remains bounded to one selected track/clip/pattern context at a time. The MVP is static: it shows before/after geometry together with the landing-page visual language—gold `+` Added notes, coral `~` Changed notes, muted dashed `−` Removed notes, and equivalent text. Animating notes between versions is a future enhancement, not an MVP requirement.

### 3. OpenMIDI Challenges

Challenges are the MVP's primary recurring community event and home-page focus.

The initial launch uses curated, administrator-created challenges. Broad user-created challenge hosting is deferred until participation and moderation are healthy.

Each challenge includes:

- title, creative prompt, artwork/presentation, and description;
- lifecycle: draft, scheduled, open, voting, completed, or cancelled;
- opening, submission, voting, and result timestamps;
- an optional immutable starter project/revision;
- machine-readable constraints;
- human-readable rules generated from the same constraint contract;
- eligibility and permitted-use terms;
- maximum entries per user;
- judging method and named host/judges where applicable;
- immutable submitted revision references.

OpenMIDI exposes one administrator-selected **featured active challenge** on the public landing page and signed-in dashboard. The card links to the canonical challenge page and reflects the real lifecycle rather than maintaining separate marketing-only challenge state. When no challenge is open, it may show the next scheduled challenge or the most recently completed challenge with an explicit label.

#### Initial constraint vocabulary

The first release supports deterministic constraints that can be evaluated from canonical MIDI/project data:

- minimum, maximum, or exact track count;
- minimum, maximum, or exact distinct instrument count;
- allowed and required instrument presets or instrument families;
- minimum, maximum, or exact tempo in BPM;
- exact time signature;
- exact declared musical key.

The constraint schema is versioned and may later add duration, note-count, polyphony, scale/pitch-class, starter-lineage, clip-count, and loop-use rules without rewriting existing challenges. Those later rules must not be exposed until their definitions and feedback are deterministic.

Natural-language prompts such as “compose something happy” remain creative guidance and are not machine judged.

The server validates constraints when an entry is submitted and again when submissions close. The checker decides eligibility, never artistic quality.

#### Entry workflow

- Start from blank, an allowed starter revision, or an allowed library clip.
- Compose in the normal Studio.
- Submit one exact immutable revision before the deadline.
- Let users preflight the current revision before submission.
- Reject an ineligible submission authoritatively and show each failed rule with its observed value and the exact change needed.
- Permit explicit replacement before the deadline; never mutate a submitted revision silently.
- Freeze the accepted entry reference when submissions close.

#### Voting and winners

Community voting opens only after submissions close. Entry ordering is randomized or rotated to reduce early-entry and popularity advantages.

- One vote per authenticated account per entry.
- No self-voting.
- Votes may be changed or removed until voting closes.
- Suspicious voting can be reviewed or excluded.
- Vote totals remain hidden until voting closes.
- Community votes select a **Community Favorite**.
- The challenge host or named judges select the official winner where the challenge has a judged winner.

The first release does not claim that a raw vote count objectively identifies the best composition.

#### Recognition

Profiles may display durable, non-transferable badges for:

- official challenge winner;
- Community Favorite;
- top placement, finalist, or honorable mention;
- participation in selected milestone/seasonal events.

Badge definitions live in an extensible catalog rather than hard-coded profile columns. Challenge completion grants immutable award records tied to the exact challenge, placement/result, recipient, and submitted revision. The initial catalog may be generic; later challenges can introduce their own artwork and award definitions without changing the award model.

Completed challenge pages remain permanently addressable unless moderation hides them. They display the original prompt, frozen constraint/rule version, dates, host/judges, eligible entries, final leaderboard/rankings, Community Favorite, official placements, and result notes. Voting and entry mutation stay closed. Every profile badge links to the exact challenge page and result that awarded it.

No XP or level system is included in MVP. Add it only if later evidence shows it improves creation and retention without rewarding spam.

### 4. Public MIDI clip library

The library turns OpenMIDI's structured source material into a browsable catalog with a clearly marked reusable commons. It should feel closer to browsing useful open-source components than downloading anonymous files, but it is not a package manager or commercial asset marketplace.

Users can explicitly list an immutable MIDI pattern version from an eligible public project with:

- title and description;
- creator and source project/revision lineage;
- instrument family and compatible preset information;
- tempo, meter, musical key/scale where declared;
- duration, bar count, note range, polyphony, and note count derived automatically;
- tags and supported reuse license/terms;
- an explicit rights basis and immutable external-credit snapshot where third-party or public-domain material is acknowledged;
- an immediate deterministic browser preview.

Other users can:

- search by pattern title, creator, and tags;
- filter by instrument family/preset, tempo range, meter, declared key, duration/bar count, note range, polyphony, note count, and reuse permission where useful;
- audition it without opening the full Studio;
- inspect its notes in a read-only piano roll;
- open a detail page with immutable version history, visual parent/source diffs, attribution/license, and the visible public projects that use the exact version or its descendants;
- for commercially reusable listings, save an exact version to a private **Saved clips** collection without duplicating its note data;
- for commercially reusable listings, import a saved or discovered exact version directly into a chosen private Studio workspace;
- for commercially reusable listings, fork it into a new private copy-on-write pattern while preserving source lineage;
- for commercially reusable listings, choose **Open in MIDI editor**, which opens an owned editable draft—creating a private fork first when the selected immutable version belongs to someone else; and
- export the supported Standard MIDI File subset only when the listing grants reuse.

Saving is a bookmark/reference action, not publication or ownership transfer. Importing or editing is copy-on-write and must retain machine-readable lineage, license, and creator attribution. Published project/revision credits snapshot the reused material so later profile, listing, or collection changes do not rewrite history.

#### Rights and licensing gate

MIDI is a digital expression of a musical composition. Recreating a recognizable melody, harmony, or arrangement may implicate rights in the underlying composition even when no sound recording is uploaded. Attribution alone does not grant permission, and selecting a different Creative Commons license cannot license rights the user does not own.

Every public listing has one explicit reuse mode:

- **Commercial reuse permitted — CC BY 4.0.** Other users may save, import, fork, open in the editor, export, adapt, and use the pattern commercially when they follow the attribution terms.
- **Reference only — reuse not granted.** Other users may search, preview, inspect notes, history, diffs, credits, and visible public usage, but cannot save it to their reusable collection, import, fork, open an editable copy, or export it through library actions. This mode is an all-rights-reserved public display choice, not a license to reuse.

Library Explore provides an **All**, **Commercial reuse permitted**, and **Reference only** filter. Cards and detail pages show the reuse mode in text, not color alone. Reuse actions are omitted or disabled with a concise explanation on reference-only listings, and server commands enforce the same boundary rather than trusting hidden controls.

Reuse mode is fixed for the exact listed version. A version already published under CC BY 4.0 cannot be relabeled reference-only because the granted license is not revoked by changing OpenMIDI metadata. A creator who wants different terms must publish and list a new eligible version. A reference-only version carries no reuse license; its separate display attestation authorizes OpenMIDI to present the notes and synthesize the browser preview under the product terms, subject to legal review before launch.

Before either kind of public library listing, the user must classify the pattern as one of:

- wholly original material they own and are authorized to publish under the selected reuse mode;
- an adaptation/reuse of material they are authorized to distribute under the selected reuse mode, with the source license or permission and required credit recorded;
- public-domain material, with source and public-domain rationale recorded; or
- a cover, recreation, adaptation, or uncertain-rights work for which they cannot confirm authority to sublicense commercially.

The interface explains the implications in plain language and links to the applicable terms. The last category cannot be publicly listed in either mode; marking an item reference-only does not create permission to distribute an unauthorized cover or adaptation. It may remain a private draft, and external credits do not override that restriction. The same check applies anywhere public project publication would make that pattern reusable, so users cannot bypass the gate by publishing through another route. Compatible adaptations require the user to affirm that their source terms and permissions allow the selected public display and downstream reuse, if any. The MVP offers one open reuse license—CC BY 4.0—and one no-reuse display mode rather than presenting alternate CC licenses as a false solution to missing rights. This workflow is risk reduction and user education, not a legal determination or warranty by OpenMIDI.

External credits can identify a non-member creator/rightsholder, role, original work title, source URL, source license/terms, and a bounded attribution note. They are immutable snapshots on a published pattern version, render separately from verified OpenMIDI creator lineage, and are included with exports. A visible notice states that credit acknowledges a source but is not proof of permission.

#### MVP boundaries

- Publishing to the library is explicit; public project clips are not automatically listed.
- Removing a saved item changes only that user's collection. Unlisting a pattern removes it from library discovery but cannot break existing project references, exports, or attribution.
- Only rights-attested pattern versions may be listed. Only listings marked **Commercial reuse permitted — CC BY 4.0** may be saved to the reusable collection, imported, forked, opened as an editable copy, or exported through library actions.
- Library listings expose a **Report unoriginal or unauthorized work** action. Reports may identify the original work/source URL and whether the reporter claims to be a rightsholder, but must not be publicly visible.
- No dependency graph, semantic-version resolver, install command, or executable content.
- No audio samples, soundfonts, plugin presets, or external binary assets.
- No paid licenses or revenue splits.
- Removal from discovery does not rewrite already published revision attribution.

### 5. Discovery, profiles, and lightweight community actions

Discovery should prioritize playable creative opportunities rather than a generic social feed.

The landing and Explore surfaces feature:

- the active curated challenge and its lifecycle state;
- challenge entries during voting/results phases;
- recent and notable MIDI projects;
- meaningful forks and revisions;
- reusable library clips;
- creators recognized by recent work rather than follower count alone.

Users can search/filter projects and library items by compatible structured metadata. Every card intended for discovery supports immediate deterministic playback without loading source audio.

Profiles include:

- public MIDI projects and revisions;
- accepted contributions and forks;
- published library material;
- challenge entries, placements, and badges;
- durable attribution and lineage links.

Challenge result finalization awards catalog-backed badges automatically. Profiles show the badge name, artwork, challenge/result source, and award date; removing a challenge from discovery does not silently erase already issued awards.

The MVP may support voting and existing contribution review actions. Generic likes, follower counts, comments, direct messages, and a personalized algorithmic feed are deferred.

### 6. Authentication, moderation, and administration

The prototype retains:

- Google sign-in and gated beta invitations where the beta remains invite-only;
- unique usernames and completed public profiles;
- administrator-managed invitations;
- reporting and administrator visibility controls;
- recoverable project/account deletion;
- holds and auditable moderation actions;
- rate limits on challenge submissions, votes, reports, project creation, and library publishing.

New moderation targets must include challenges, challenge entries, votes where abuse review requires them, library listings, and the immutable pattern versions behind reported listings. Library reports include a dedicated unoriginal/unauthorized-work reason and bounded claimant/source context. Administrators can hide a listing immediately, preserve the report and immutable evidence for review, record a decision, and remove or restore discovery without rewriting project history. OpenMIDI must publish a clear copyright/contact process before unrestricted public launch; the in-product report flow is not represented as a complete legal takedown process.

### 7. Beta feedback and administrator triage

Invited users need a low-friction way to tell the team when the prototype is confusing or broken.

Authenticated users can submit either a **bug report** or **suggestion** with:

- a short summary;
- plain-text details;
- the current application route and application version captured automatically;
- optional bounded browser/platform metadata shown to the user before submission; and
- a clear success confirmation and reference ID.

Feedback is stored as Postgres data, not uploaded to Storage. The MVP does not accept screenshots, recordings, file attachments, console logs, cookies, tokens, complete manifests, or signed URLs. Submission is rate-limited and suspended users cannot submit.

Administrators receive a private queue separate from abuse/content reports. They can review, classify, mark handled, and delete irrelevant feedback. Deletion removes the submitted content; a minimal private audit action may retain who deleted which feedback ID/category and when, without retaining the discarded body. Relevant items are manually converted into GitHub issues by an administrator; OpenMIDI does not receive GitHub credentials or create issues automatically in the MVP.

## Features deliberately deferred

### Daily composition prompts

Do not build a separate daily-prompt product in the MVP. It would divide a small community across too many simultaneous events and produce empty leaderboards.

Use the challenge system to run one prominent recurring prompt at a sustainable cadence—initially weekly or biweekly. If participation supports it, a future lightweight daily format can reuse the same challenge, submission, validation, voting, and result primitives.

### “One more instrument” matchmaking

The underlying idea is useful, but automated or queue-based matchmaking requires community liquidity, abandonment handling, compatible skill matching, notifications, and turn ownership. Defer it.

The existing contribution model may later expose structured open track slots such as “add bass” or “add drums” without promising matchmaking.

### Collaborative soundtracks and playlists

The “RPG soundtrack” concept is compelling but introduces a second hierarchy above projects, multiple requested deliverables, collection-level review, sequencing, completion state, and rights rules. Defer it until individual challenge and contribution loops are healthy.

It should eventually become a **Collection Project**: a themed collection with named slots, exact accepted project revisions, an owner/editorial workflow, and collection playback.

### Seasonal community albums

Community albums are a strong future editorial event, not a separate foundational system. Build them later from challenges plus Collection Projects. Curated selection should combine judges and Community Favorite recognition rather than blindly selecting the highest raw vote totals.

### XP and levels

Defer numerical progression. XP systems reward whatever is easiest to count and create incentives for spam, vote trading, low-effort submissions, and status anxiety. Launch with specific earned badges tied to real creative outcomes; revisit progression only with evidence.

## Key user stories

### As a bedroom producer

- I can open the Studio and start a playable MIDI idea quickly.
- I can publish a version and see a useful explanation of what changed.
- I can fork an interesting project and make it my own without losing attribution.
- I can enter a constraint challenge and understand why my entry is or is not eligible.
- I can receive recognition even if I do not already have a large following.

### As a casual musician or learner

- I can inspect the notes and arrangement behind something I hear.
- I can compare two versions visually and learn how the music changed.
- I can begin with a prompt, starter project, or reusable clip instead of a blank canvas.
- I can search by musical properties, preview a pattern, save its exact version, and place it into a Studio project later.
- I can import a clip, transform it, and know that its creator remains credited.
- I can fork or open a library clip directly in the MIDI editor without losing its exact source lineage.
- I am warned when a cover, recreation, or adaptation may not be eligible for commercial CC reuse, and I can record required external credits without being told that credit equals permission.
- I can export MIDI to continue experimenting elsewhere.

### As a remixer or contributor

- I can derive work from an exact public revision.
- I can submit an immutable change proposal or publish an independent fork.
- I can see semantic differences before submitting or reviewing.
- I can understand the lineage and permitted use of material I reuse.

### As a challenge participant

- I can see the creative prompt, exact rules, deadline, and judging method before composing.
- I can validate my work before final submission.
- I can replace my entry explicitly before the deadline.
- I can listen to entries in a fairer browsing order and vote after submissions close.
- My placement and participation remain connected to the exact work I submitted, and any badge links back to the permanent challenge results.

### As a listener

- I can play projects, entries, revisions, and clips immediately.
- I can discover how a project evolved and follow its remix lineage.
- I can vote without creating or downloading audio files.

### As a beta participant

- I can report a bug or suggestion without leaving OpenMIDI.
- I can understand what diagnostic context will be submitted and receive confirmation that it was recorded.

### As an administrator

- I can create and schedule a challenge from a bounded rule vocabulary.
- I can preview how its rules will be presented and validated.
- I can moderate projects, entries, library listings, accounts, and suspicious votes.
- I can triage reports that a listed clip is unoriginal or unauthorized, hide it while reviewing evidence, and record a decision without rewriting immutable music history.
- I can record official results without changing submitted revisions.
- I can review, classify, handle, or delete beta feedback without exposing it publicly.

## MVP release requirements

The MIDI-only MVP is ready for invited public testing when all of the following are true:

### Creation

- A new user can create, save, reload, play, and publish a multi-track MIDI project.
- Studio timing and controls remain synchronized during normal editing and playback.
- Standard MIDI import/export works for the documented bounded subset.
- No normal product route offers source-audio upload or depends on legacy audio data.

### Versioning and reuse

- Revisions, contributions, and forks preserve immutable lineage and attribution.
- Structured summaries are deterministic and correct for supported changes.
- Any two authorized revisions in one project and any two authorized versions in one pattern history can be compared with a useful accessible static visual diff.
- Every published library clip can be searched, filtered by reuse mode, previewed, and inspected. Commercially reusable clips can also be saved, imported, forked, opened in the MIDI editor, transformed, exported, and credited; reference-only clips reject those reuse paths.
- Library detail exposes immutable history and visible public-project usage without leaking private projects.
- Library publication blocks uncertain-rights covers/recreations from both public modes, preserves external credits separately from platform lineage, and supports unoriginal/unauthorized-work reporting.

### Challenges

- An administrator can schedule a curated challenge with supported track-count, instrument-count/family/preset, BPM, meter, and key constraints.
- Users can compose, preflight, submit, and explicitly replace an eligible entry.
- Submission closure, voting, official results, and Community Favorite are deterministic and auditable.
- The featured active challenge appears on the landing page and dashboard, and completed challenge pages retain frozen details and final rankings.
- Invalid or late entries cannot bypass authoritative validation.
- Challenge pages remain useful with a small invited community.

### Recognition and feedback

- Completed challenge results issue durable catalog-backed badges for winners, Community Favorites, and configured top placements.
- Profiles display awards as links to their exact completed challenge page and result source.
- Authenticated beta users can submit rate-limited bugs and suggestions without attachments or sensitive diagnostics.
- Administrators can review, classify, handle, and delete feedback in a private queue.

### Safety and operations

- RLS and command authorization cover all challenge, vote, library, revision, and draft paths.
- Suspended or hidden actors cannot publish, submit, vote, or bypass moderation.
- Rate limits and uniqueness constraints prevent obvious vote and submission abuse.
- User content and challenge terms have reporting and moderation paths.
- Public library listings have a rights attestation, immutable external-credit display, unoriginal/unauthorized-work reporting, and a documented copyright/contact process before unrestricted launch.
- Feedback, saved clips, badges, challenge entries, and votes have explicit RLS and command authorization.
- The application runs within the prototype's $0 database, compute, and bandwidth budget under the intended invited-user load.
- The production schema can be reset/seeded deliberately before launch without preserving experimental audio data.

### Seed content and deployment

- The frontend, metadata, documentation, repository links, OAuth branding, deployment configuration, persisted engine identifiers, runtime namespaces, fixtures, and current migration source consistently use OpenMIDI, with no active dependency on the former prelaunch identity.
- The beta launches with several useful public projects, a curated set of listed MIDI patterns, and one scheduled/open challenge so discovery is not empty.
- Vercel is configured with reviewed environment-variable scopes and the existing hosted Supabase project.
- Google OAuth callback/site URLs, the invitation hook, avatar processing, migrations, and application origins are verified against the production URL.
- One production smoke path covers invited sign-in, onboarding, Studio creation/publication, library save/import, challenge preflight/submission, feedback intake, and administrator queues.
- A documented rollback/disable path exists for deployment, challenge intake, and invitations without rewriting immutable musical history.

### Accessibility and experience

- Studio, challenge submission, voting, project history, diff navigation, and clip import support keyboard use.
- Status, eligibility, added/removed/changed diff states, and playback are not communicated by color or animation alone.
- Reduced-motion preferences are respected.
- Primary creation and playback flows work on the supported desktop browser baseline; smaller screens retain discovery and listening even when full editing is constrained.

## Success measures

Initial measurements should establish a baseline rather than optimize vanity metrics.

### Activation

- Percentage of invited users who play something, enter the Studio, and create a meaningful edit
- Percentage who publish a first project, fork, library clip, or challenge entry
- Median time from first sign-in to first audible edit and first publication

### Creation and return behavior

- Completed eligible entries per active challenge
- Percentage of starters who reach publication/submission
- Users returning for a later challenge or another project
- Revisions per active creator without counting autosaves

### Remix and reuse

- Public projects that receive a fork or contribution
- Library searches that lead to a preview, save, or Studio import
- Saved clips later imported into a workspace
- Library clips imported into another user's project
- Imported clips that lead to a published revision
- Fork and contribution histories that continue beyond one derivative

### Competition health

- Unique listeners distributed across entries
- Percentage of eligible entries receiving meaningful exposure
- Vote participation without suspicious concentration
- Repeat participation and first-time entrant representation
- Moderator interventions and disqualifications
- Challenge placements and badges that lead recipients back to the source challenge/project

### Beta learning

- Bugs and suggestions submitted per active beta cohort without spam concentration
- Percentage of feedback reviewed, discarded, or manually converted into a tracked issue
- Repeated reports that identify the same broken or confusing workflow

Follower count, total raw votes, total notes, total projects, and time spent in the app are not sufficient success measures by themselves.

## Product risks and mitigations

### Empty-community risk

Too many simultaneous formats will make every surface feel abandoned. Launch with one curated challenge at a time, seed a small set of strong public projects/clips, and reuse the same primitives instead of launching daily prompts, albums, soundtracks, and matchmaking together.

### Popularity bias and vote abuse

Hide totals during voting, separate Community Favorite from judged winner, randomize/rotate exposure, prevent self-votes, enforce uniqueness and rate limits, and retain auditable moderation state.

### Feedback privacy and triage debt

Collect only bounded plain text and disclosed route/version/browser context. Reject attachments and sensitive diagnostics, keep the queue administrator-only, rate-limit intake, and let administrators discard low-value submissions. Do not promise that every suggestion becomes roadmap work.

### Weak instrument quality

MIDI projects are only enjoyable if deterministic built-in instruments sound good enough. Maintain a small, versioned, curated preset set rather than a large inconsistent catalog. Instrument upgrades create new versions; they do not rewrite published playback.

### Copyright and reuse confusion

Require a rights-basis choice and explicit authority for the selected commercially reusable or reference-only public mode before library publication. Warn that MIDI recreations can implicate the underlying composition and that attribution or reference-only status is not permission. Block uncertain-rights covers/recreations from library listing, preserve platform lineage and external credits separately, support dedicated unoriginal/unauthorized-work reports and temporary hiding, and publish a copyright/contact process before unrestricted launch. Do not claim that OpenMIDI has adjudicated ownership merely because a user passed the attestation.

### Studio scope expansion

Use challenge, diff, and reuse outcomes to prioritize editor work. Do not chase professional DAW parity, audio support, advanced synthesis, notation, or plugin hosting before the core loop is proven.

### Historical architecture transition

PIVOT-00 through PIVOT-10 resolved the repository strategy, reset posture, manifest-v3 domain, preset runtime, retained product foundations, complete audio removal, clean migration baseline, and hosted rehearsal. The final `master` reconciliation retained administrator-managed invitations through a forward migration. Git history preserves the transition evidence without replaying the pre-pivot create/alter/drop chain.

## Remaining product decisions

The [tracked roadmap](ROADMAP.md) records the completed path through semantic visual diffs, beta feedback, the public MIDI library, curated challenges, challenge awards, identity reset, seeded-beta hardening, and the authorized RELEASE-03 rollout. The retained hosted schema and linked ledger now match all 16 reviewed migrations, the deterministic beta seed is imported, and the invite-only application is deployed. A public copyright/contact channel remains required before any unrestricted launch.
