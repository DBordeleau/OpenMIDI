# Jam Session - Product Requirements Document

## Elevator Pitch

**Jam Session** is a collaborative music production platform inspired by Git and open-source software development. Musicians create versioned MIDI arrangements—and, when sustainable storage is available, audio-stem projects—that others can contribute to, remix, or fork into entirely new works. Instead of collaborating through scattered files and messaging apps, creators work together in a shared, versioned workspace designed specifically for music.

---

## Problem

Modern music production is more accessible than ever, but it remains a largely solitary hobby. Many producers and musicians struggle to find collaborators with compatible interests, schedules, or technical ability. Remote collaboration is often fragmented across file-sharing services, messaging apps, and DAWs with little visibility into project history or contributor attribution.

Jam Session makes collaboration asynchronous and accessible by treating songs like open-source projects. Musicians can compose and record MIDI tracks in the browser, propose arrangement changes, contribute compatible material, remix existing work, and receive credit without needing to coordinate traditional studio sessions or share one desktop DAW.

---

## Target Users

- Hobbyist producers
- Amateur musicians
- Bedroom producers
- Students learning music production
- Small independent artists and bands
- Online music communities

And to a lesser extent:

- Producers looking for session musicians
- Content creators searching for royalty-free collaborations

---

## Goals

- Make remote, asynchronous music collaboration as simple as recording/editing MIDI tracks—or, when audio admission is available, uploading a stem—and submitting the result like a PR.
- Reduce the friction involved in finding collaborators.
- Encourage experimentation through remixing and project forking.
- Allow musicians to create, audition, and mix MIDI arrangements and compatible project stems without requiring every collaborator to own the same desktop DAW.
- Give contributors enough in-browser production tooling to understand a project and make meaningful changes.
- Reduce the friction involved in exchanging project files, synchronizing arrangements, and reproducing collaborators' instrument parts.
- Preserve clear attribution and project lineage across contributions, revisions, and forks.

---

## Non-Goals

Jam Session is not intended to replace a professional desktop DAW.

The MVP will not include:

- Feature parity with established DAWs such as Ableton Live, Logic Pro, FL Studio, or Pro Tools
- Support for third-party desktop audio plugins such as VST, Audio Units, or AAX plugins
- Compatibility with every proprietary DAW project format
- Real-time, multi-user editing of the same project
- A complete professional mixing and mastering workflow
- Advanced notation, scoring, or audio-engineering tools
- Native desktop or mobile applications
- Music distribution to streaming platforms
- A marketplace, payment system, or rights-dispute resolution service
- Copyright dispute resolution
- AI-generated music features

The browser workspace should support the Jam Session collaboration workflow, rather than expose every possible feature of the underlying audio editor.

---

## Core Features

### Authentication

- Sign in with Google
- User profiles with username and avatar

### User Profiles

- Public profile page
- Projects created
- Contributions made
- Followers (future-ready, optional in MVP)

### Music Projects

- Create a new project
- Create multiple MIDI instrument tracks
- Upload stems when audio admission is available
- Add project description, genre, BPM, key, and tags
- Mark projects as open for collaboration

### MIDI Composition

- Create and edit MIDI parts directly inside the selected project Studio
- Choose from versioned built-in synth and drum sounds
- Draw and edit notes in a piano roll
- Organize notes into clips and loops
- Record from an on-screen piano or computer keyboard
- Record from supported hardware MIDI devices as an optional enhancement
- Import and export a bounded Standard MIDI File subset

### Legacy Audio Management

- Preserve authorized playback, preview, download, export, attribution, and arrangement of existing stems
- Label retained stems by instrument or role
- Re-enable new stem admission only after a sustainable storage decision; it becomes unavailable only after the Studio-native MIDI parity transition during the prototype

### Browser Track Mixer

- Play MIDI and compatible legacy audio tracks in sync
- Individual volume controls
- Mute and solo tracks
- Pan controls
- Timeline playback

### Contributions

- Submit MIDI arrangement/track changes and compatible changes to legacy projects
- Project owner reviews submissions
- Accept or reject contributions

### Forking

- Fork an existing project
- Continue development independently
- Preserve attribution to the original project

### Discovery

- Browse projects
- Search by genre, tags, BPM, key, and instruments
- View recent and trending projects

### Integrated Browser Workspace

Studio is a first-class authenticated workspace: users open Studio, then create, choose, or safely switch the project they want to work on. Projects remain the durable authorization, collaboration, and history boundary; Studio is not a new persisted domain entity. A selected project remains deep-linkable and only one live editor/audio graph is active at a time.

Inside that browser-based music workspace, users can:

- Play MIDI and compatible legacy audio tracks in sync
- View and arrange MIDI clips and compatible audio regions on a timeline
- Draw, move, resize, duplicate, delete, velocity-edit, and quantize MIDI notes
- Record MIDI notes into an armed track
- Choose deterministic versioned instrument sounds
- Adjust volume and stereo position
- Mute and solo tracks
- Add, remove, and reposition compatible MIDI material
- Save the resulting project state
- Export or submit their work through Jam Session's contribution workflow

The primary workflow keeps composition and arrangement in this Studio. Adding a MIDI track opens the Jam Session piano roll within the Studio shell; recording follows the project transport so the musician can perform against the other audible tracks. Editing an existing MIDI clip creates a private draft derived from its exact immutable stem version. Draft autosave protects the musician's work, but it does not change the project. An explicit **Save version and add to arrangement** or **Save new version and replace clip** action freezes immutable notes and updates the private workspace under optimistic concurrency. My stems and the standalone editor remain available for library management, direct editing, import/export, and accessibility fallback.

Additional audio editing/recording, effects, automation, advanced MIDI expression, and notation capabilities may be exposed where they are stable and appropriate, but they are not all required for the initial release.

For the MVP, this workspace uses a Jam Session-owned composite client-only adapter: the pinned MIT-licensed Tone.js runtime schedules MIDI synthesis, while Waveform Playlist retains compatibility with existing audio projects. Manifest v2 gives MIDI and compatible audio regions stable clip identities; existing manifest-v1 history remains readable and immutable. Jam Session's versioned manifest remains the persisted authority; the application must not depend on editor objects or an opaque project format. A fuller OpenDAW integration is a post-MVP option and is not an MVP dependency.

---

## MVP Scope

The active prototype creation path is MIDI-first so the application can remain inside a $0 infrastructure budget. New source-audio admission is disabled only after the complete MIDI creation and collaboration journey is available. This is a global prototype capability, not a payment or entitlement system.

Repository implementation now covers that Studio-native journey and its compatibility regressions. The hosted capability remains enabled until an authorized operator accepts the parity evidence and performs the separately approved transition; repository completion is not authority to mutate hosted admission.

Existing audio projects and immutable history remain private, playable, downloadable, exportable, forkable, and compatible with publication/contribution workflows. They are not deleted, hidden, converted to MIDI, or made public. New projects default to MIDI; a legacy project may combine its already-referenced audio with newly created MIDI tracks.

At minimum, users must be able to:

- Open a Jam Session project in the browser
- Create multiple MIDI tracks with deterministic built-in instrument sounds
- Draw and edit notes and clips in an accessible Studio-integrated piano roll
- Record notes from on-screen/computer-keyboard input and supported hardware MIDI input
- Load MIDI and compatible legacy audio tracks into synchronized playback
- Play, pause, seek, mute, solo, pan, and adjust track volume
- Add, remove, position, loop, and quantize compatible MIDI material
- Save the project's editable workspace state
- Create a contribution from their changes
- Fork a project while preserving its attribution and lineage
- Export a standard MIDI file and retain authorized downloads/exports for existing audio projects

Advanced capabilities available through the underlying browser audio technology are optional for the MVP unless explicitly promoted into scope.

---

## User Stories

### As a producer

- I can create a MIDI project, choose sounds, and compose or record multiple tracks.
- I can record a MIDI part against the rest of my arrangement and place it on the shared Studio timeline without leaving the Studio.
- When audio admission is available in a future storage model, I can create projects from uploaded stems.
- I can invite the community to contribute new ideas.
- I can review submissions before accepting them.
- I can fork someone else's project and create my own version.

### As a musician

- I can discover projects looking for contributions.
- I can edit or record MIDI parts without owning the creator's desktop DAW.
- I can export MIDI for use inside my preferred DAW.
- I retain authorized stem downloads for existing audio projects.
- I receive credit when my contribution is accepted.

### As a listener

- I can explore projects.
- I can compare different forks and remixes.
- I can discover new musicians through their work.

---

## Future Ideas

### Collaboration

- Real-time collaborative editing
- Live jam sessions
- Comments on timelines
- Review threads on contributions

### DAW

- Audio recording
- Advanced MIDI expression and controllers
- Effects chains
- Automation
- Plugin support
- Waveform editing

### Social

- Following creators
- Likes
- Comments
- Playlists
- Activity feed

### Project Management

- Branches
- Version history
- Release tags
- Project milestones

### Monetization

- Paid collaboration requests
- More stem/project storage
- Tip creators
- Marketplace for stems
- Licensing options
