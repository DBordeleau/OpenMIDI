# Waveform Playlist adapter boundary

This directory is the only allowed dependency boundary for Waveform Playlist, Tone.js, and browser audio APIs.

The adapter is client-only and lazy-loaded. It translates between pinned editor packages and Jam Session's validated, versioned workspace manifest. Editor library types, live `AudioBuffer` instances, signed URLs, and UI state must not escape this boundary.

Before adding code here, read the [system architecture](../../../../docs/technical-design/01-system-architecture.md) and [architectural decisions](../../../../docs/technical-design/decisions/README.md). PR 05 must prove deterministic manifest hydration/export, synchronized playback, promoted mixer/timeline actions, export, bundle isolation, and Vercel/browser compatibility before production studio work proceeds.

OpenDAW is a post-MVP option and must not be added here without a superseding ADR and a dedicated integration/licensing plan.
