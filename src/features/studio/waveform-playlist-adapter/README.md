# Waveform Playlist adapter boundary

This directory is the only allowed dependency boundary for Waveform Playlist, Tone.js, and browser audio APIs.

The adapter is client-only and lazy-loaded. It translates between pinned editor packages and Jam Session's validated, versioned workspace manifest. Editor library types, live `AudioBuffer` instances, signed URLs, and UI state must not escape this boundary.

Before adding code here, read the [system architecture](../../../../docs/technical-design/01-system-architecture.md) and [architectural decisions](../../../../docs/technical-design/decisions/README.md). PR 05 must prove deterministic manifest hydration/export, synchronized playback, promoted mixer/timeline actions, export, bundle isolation, and Vercel/browser compatibility before production studio work proceeds.

OpenDAW is a post-MVP option and must not be added here without a superseding ADR and a dedicated integration/licensing plan.

## Validated PR 05 package surface

The spike pins `@waveform-playlist/browser` 15.3.4, `@waveform-playlist/playout` 12.5.4, `tone` 15.1.22, `@dnd-kit/react` 0.3.2, and `styled-components` 6.4.3. Recording, MIDI, annotations, spectrograms, WAM, and media-element playout are intentionally not installed.

Only files in this directory may import those packages. `index.client.ts` is the lazy browser entry; it must never be re-exported from a feature-root or shared server barrel. Manifest schemas and the engine-neutral `StudioAdapter` contract remain server-import-safe.

The main browser entry supplies the React provider and waveform UI. The `/tone` subpath supplies fixture decoding/export hooks, while the playout package resumes the shared audio context only after a user gesture. Jam Session IDs are mapped directly to Waveform Playlist track/clip IDs and fixture or future signed URLs remain transient load inputs.
