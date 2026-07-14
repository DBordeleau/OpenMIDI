# Waveform Playlist adapter boundary

This directory is the only allowed dependency boundary for Waveform Playlist, Tone.js, and browser audio APIs.

The adapter is client-only and lazy-loaded. It translates between pinned editor packages and Jam Session's validated, versioned workspace manifest. Editor library types, live `AudioBuffer` instances, signed URLs, and UI state must not escape this boundary.

Development builds expose bounded User Timing marks through `performance-marks.client.ts`. Marks contain lifecycle names and source indexes only—never signed URLs, Storage paths, asset IDs, filenames, track labels, or audio. Production builds emit no studio timing marks. OPT-02 separates shell readiness from source/peaks/playback readiness without changing manifest authority.

Before adding code here, read the [system architecture](../../../../docs/technical-design/01-system-architecture.md) and [architectural decisions](../../../../docs/technical-design/decisions/README.md).

The production surface accepts a validated revision or workspace manifest and synchronously creates placeholder `ClipTrack`s before source authorization. It then obtains one exact-authority signed batch and downloads/decodes at concurrency three, attaching each completed buffer to its stable track without replacing unrelated adapter state. Authorization failures refresh that batch once; track failures remain isolated and retryable. Disposal aborts outstanding work, ignores late resolutions, pauses playback, and closes the owned decode context.

The session registry is capped at 12 decoded/in-flight entries and 384 MiB, evicts least-recently-used decoded buffers, removes failed work, and clears on verified actor change or sign-out. Keys are immutable asset IDs inside one active actor boundary, never signed URLs. Nothing persists across browser sessions.

Revision mode remains read-only for persistence. Workspace mode supports add/remove/reorder, position, trim, label, instrument, gain, pan, mute, and solo before audio is ready, then exports only the validated Jam Session manifest. Playback requires every audible track; muted unready tracks do not block, but unmuting one re-locks transport. Authorized users can render a bounded 16-bit WAV mix only after every track is decoded; source-stem downloads remain direct-to-Storage outside the adapter.

OpenDAW is a post-MVP option and must not be added here without a superseding ADR and a dedicated integration/licensing plan.

## Validated package surface

The production boundary retains the PR 05 exact pins: `@waveform-playlist/browser` 15.3.4, `@waveform-playlist/playout` 12.5.4, `tone` 15.1.22, `@dnd-kit/react` 0.3.2, and `styled-components` 6.4.3. Recording, MIDI, annotations, spectrograms, WAM, and media-element playout are intentionally not installed.

Only files in this directory may import those packages. `index.client.ts` is the lazy browser entry; it must never be re-exported from a feature-root or shared server barrel. Manifest schemas and the engine-neutral `StudioAdapter` contract remain server-import-safe.

The main browser entry supplies the React provider and waveform UI. The playout package resumes the shared audio context only after a user gesture. Jam Session IDs are mapped directly to Waveform Playlist track/clip IDs. Signed URLs remain transient inputs and must never be logged, persisted, rendered, or returned from this boundary.
