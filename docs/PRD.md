# Jam Session — Product Requirements Document

Status: Approved MIDI-only MVP; foundation implemented locally through PIVOT-09

Last updated: 2026-07-16

Supersedes: The collaboration-first, MIDI-plus-legacy-audio MVP definition

## Product summary

Jam Session is a public playground for making, remixing, and competing with MIDI music.

Bedroom producers and casual musicians create complete arrangements in a browser Studio, publish meaningful musical revisions, fork each other's work, reuse credited MIDI clips, and enter playful composition challenges with machine-checkable constraints. Jam Session borrows the best ideas from open-source development—version history, diffs, forks, contributions, and durable attribution—without requiring users to understand Git or own a professional DAW.

The MVP is MIDI-only. It does not accept, store, arrange, preview, or distribute uploaded source-audio files.

## Product thesis

Most beginner and hobbyist music tools optimize for solitary creation or professional production. They give users a blank canvas, then leave them to find inspiration, material, feedback, and an audience elsewhere.

Jam Session should optimize for a different moment:

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

Jam Session must help users:

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

“Revision 4” is not enough. Jam Session should explain which tracks, clips, notes, instruments, tempo, meter, key, and mixer values changed.

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
- Establish a healthy creation-remix-vote-return loop before investing in broad social mechanics.
- Keep the prototype viable on a $0 infrastructure budget by avoiding uploaded source audio.
- Preserve deterministic playback, immutable published history, attribution, and moderation boundaries.

## Non-goals

The MVP will not include:

- Source-audio, stem, sample, vocal, or microphone uploads
- Audio recording, waveform editing, time stretching, mastering, or server-stored audio exports/previews
- Professional DAW parity
- VST, Audio Unit, AAX, or other third-party plugin hosting
- Proprietary DAW project import or export
- Real-time multi-user editing or live jam sessions
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

Standard MIDI File import and export remain supported. The browser Studio should be capable and enjoyable, but it is not intended to replace Ableton Live, FL Studio, Logic, REAPER, or another professional DAW.

Users may render a deterministic local audio file from MIDI synthesis as a browser-only download. That file is never uploaded, versioned, shared, or treated as project authority.

## MVP product loop

The primary loop is:

1. A user discovers an active challenge, interesting project, revision, or reusable clip.
2. They listen immediately in the browser.
3. They create from a blank project, fork a project, import a clip, or open a challenge starter.
4. They compose and arrange in the Studio.
5. They publish a revision or submit an immutable challenge entry.
6. Jam Session shows what changed and preserves every source relationship and credit.
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
- Render a local synthesized audio download without uploading it to Jam Session.

The Studio must open quickly without network-bound media hydration. Playback uses deterministic versioned instrument definitions so a published revision remains reproducible.

#### MVP quality bar

- A new user can create their first note without navigating away from the Studio.
- Empty-track and add-track actions are visible and understandable.
- Playback, playhead, note events, mixer changes, and visualization remain synchronized.
- Keyboard-only creation and editing paths remain usable.
- A published project can be reconstructed from structured Jam Session data without live editor objects.

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

The MVP includes a bounded visual comparison for one selected MIDI track or clip:

- before/after note overlays in the piano roll;
- clear added, removed, and changed states that do not rely on color alone;
- a track/clip navigator linked to the structured summary;
- playback of either immutable side;
- no attempt to automatically merge the two versions.

A full project-wide animated diff, notation diff, or three-way merge is deferred.

### 3. Jam Session Challenges

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

#### Initial constraint vocabulary

The MVP supports deterministic constraints that can be evaluated from canonical MIDI/project data:

- maximum or exact track count;
- allowed or required instrument presets/families;
- tempo range or exact tempo;
- meter;
- maximum duration;
- allowed pitch classes, key, or scale;
- maximum note count;
- maximum simultaneous notes/polyphony;
- required use of a starter clip or project lineage;
- clip-count or loop-use bounds.

Rules such as “use only three-note chords” should launch only when their musical definition is unambiguous in the constraint contract. Natural-language prompts such as “compose something happy” remain creative guidance and are not machine judged.

The server validates constraints when an entry is submitted and again when submissions close. The checker decides eligibility, never artistic quality.

#### Entry workflow

- Start from blank, an allowed starter revision, or an allowed library clip.
- Compose in the normal Studio.
- Submit one exact immutable revision before the deadline.
- Show failed constraints with actionable musical explanations.
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
- finalist or honorable mention;
- participation in selected milestone/seasonal events.

No XP or level system is included in MVP. Add it only if later evidence shows it improves creation and retention without rewarding spam.

### 4. Public MIDI clip library

The library turns Jam Session's structured source material into a reusable commons. It should feel closer to browsing useful open-source components than downloading anonymous files, but it is not a package manager or commercial asset marketplace.

Users can explicitly publish an immutable MIDI clip/stem version from an eligible public project to the library with:

- title and description;
- creator and source project/revision lineage;
- instrument family and compatible preset information;
- tempo, meter, musical key/scale where declared;
- duration, bar count, note range, polyphony, and note count derived automatically;
- tags and supported reuse license/terms;
- an immediate deterministic browser preview.

Other users can:

- search and filter library material;
- audition it without opening the full Studio;
- inspect its notes in a read-only piano roll;
- import a compatible copy into a private workspace;
- fork/edit it into a new immutable version;
- export the supported Standard MIDI File subset.

Importing or forking must retain machine-readable lineage and creator attribution. Published project/revision credits snapshot the reused material so later profile or library changes do not rewrite history.

#### MVP boundaries

- Publishing to the library is explicit; public project clips are not automatically listed.
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

New moderation targets must include challenges, challenge entries, votes where abuse review requires them, and library listings. Hiding a listing or entry affects discovery and eligibility without mutating immutable project history.

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
- I can import a clip, transform it, and know that its creator remains credited.
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
- My placement and participation remain connected to the exact work I submitted.

### As a listener

- I can play projects, entries, revisions, and clips immediately.
- I can discover how a project evolved and follow its remix lineage.
- I can vote without creating or downloading audio files.

### As an administrator

- I can create and schedule a challenge from a bounded rule vocabulary.
- I can preview how its rules will be presented and validated.
- I can moderate projects, entries, library listings, accounts, and suspicious votes.
- I can record official results without changing submitted revisions.

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
- A selected clip/track can be compared with a useful visual diff.
- A published library clip can be discovered, previewed, imported, transformed, and credited.

### Challenges

- An administrator can schedule a curated challenge with supported constraints.
- Users can compose, preflight, submit, and explicitly replace an eligible entry.
- Submission closure, voting, official results, and Community Favorite are deterministic and auditable.
- Invalid or late entries cannot bypass authoritative validation.
- Challenge pages remain useful with a small invited community.

### Safety and operations

- RLS and command authorization cover all challenge, vote, library, revision, and draft paths.
- Suspended or hidden actors cannot publish, submit, vote, or bypass moderation.
- Rate limits and uniqueness constraints prevent obvious vote and submission abuse.
- User content and challenge terms have reporting and moderation paths.
- The application runs within the prototype's $0 database, compute, and bandwidth budget under the intended invited-user load.
- The production schema can be reset/seeded deliberately before launch without preserving experimental audio data.

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
- Library clips imported into another user's project
- Imported clips that lead to a published revision
- Fork and contribution histories that continue beyond one derivative

### Competition health

- Unique listeners distributed across entries
- Percentage of eligible entries receiving meaningful exposure
- Vote participation without suspicious concentration
- Repeat participation and first-time entrant representation
- Moderator interventions and disqualifications

Follower count, total raw votes, total notes, total projects, and time spent in the app are not sufficient success measures by themselves.

## Product risks and mitigations

### Empty-community risk

Too many simultaneous formats will make every surface feel abandoned. Launch with one curated challenge at a time, seed a small set of strong public projects/clips, and reuse the same primitives instead of launching daily prompts, albums, soundtracks, and matchmaking together.

### Popularity bias and vote abuse

Hide totals during voting, separate Community Favorite from judged winner, randomize/rotate exposure, prevent self-votes, enforce uniqueness and rate limits, and retain auditable moderation state.

### Weak instrument quality

MIDI projects are only enjoyable if deterministic built-in instruments sound good enough. Maintain a small, versioned, curated preset set rather than a large inconsistent catalog. Instrument upgrades create new versions; they do not rewrite published playback.

### Copyright and reuse confusion

Require explicit supported reuse terms for library publishing and challenge starters. Preserve source lineage and immutable credit snapshots. Do not claim to adjudicate ownership disputes.

### Studio scope expansion

Use challenge, diff, and reuse outcomes to prioritize editor work. Do not chase professional DAW parity, audio support, advanced synthesis, notation, or plugin hosting before the core loop is proven.

### Historical architecture transition

PIVOT-00 through PIVOT-09 resolved the repository strategy, reset posture, manifest-v3 domain, preset runtime, retained product foundations, and complete local removal inventory. The clean migration baseline and Git history preserve the appropriate evidence without replaying the pre-pivot create/alter/drop chain.

## Remaining product decisions

The [tracked roadmap](ROADMAP.md) sequences semantic visual diffs, the public pattern library, and challenges. Each future slice must still specify its UI and validation detail, but it must not revisit the accepted MIDI-only persistence, licensing, immutable-history, or avatar-only Storage boundaries without a superseding product decision and ADR. Hosted rehearsal/cutover remains PIVOT-10 and requires explicit approval.
