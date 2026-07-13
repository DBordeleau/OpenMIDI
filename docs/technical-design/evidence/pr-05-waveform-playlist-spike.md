# PR 05 Waveform Playlist/Vercel spike evidence

Status: Conditional pass  
Date: 2026-07-12  
Author: Codex implementation agent  
Commit: uncommitted local worktree at evidence capture  
Environment: Windows, Node 24.18.0, npm 11.11.1, Next.js 16.2.10, local Supabase CLI stack, Playwright Chromium

## Decision

Use the React provider surface in `@waveform-playlist/browser` for PR 09, with its `/tone` entry and `@waveform-playlist/playout` for multitrack playback and offline WAV export. The package surface preserves stable Jam Session IDs, stays behind the client-only lazy boundary, and production-builds without browser-module evaluation.

This is a **conditional pass** because local Chromium automation passed, but Firefox/Safari perceptual checks and Vercel Preview deployment require environments/authority not available in this implementation thread. No product or persisted-format blocker was found.

## Exact package surface

Registry metadata was inspected on 2026-07-12. The upstream repository is `https://github.com/naomiaro/waveform-playlist`; npm metadata identifies the `packages/browser` and `packages/playout` monorepo directories but exposes no matching Git tag or `gitHead` for these releases.

| Package                      | Version | Role                                       |                         Unpacked size | License |
| ---------------------------- | ------: | ------------------------------------------ | ------------------------------------: | ------- |
| `@waveform-playlist/browser` |  15.3.4 | React provider, waveform UI, Tone hooks    |                       2,132,449 bytes | MIT     |
| `@waveform-playlist/playout` |  12.5.4 | Tone playout adapter and context lifecycle |                         561,959 bytes | MIT     |
| `tone`                       | 15.1.22 | Web Audio graph and offline rendering      |                       5,401,640 bytes | MIT     |
| `@dnd-kit/react`             |   0.3.2 | supported timeline drag surface            | dependency graph recorded in lockfile | MIT     |
| `styled-components`          |   6.4.3 | required Waveform Playlist styling peer    | dependency graph recorded in lockfile | MIT     |

The browser package supports React 18/19. Recording, annotations, media-element playout, WAM, MIDI, and spectrogram packages are optional peers and were not installed. The installed dependency graph is reproducible with `npm ls @waveform-playlist/browser @waveform-playlist/playout @waveform-playlist/core @waveform-playlist/engine tone @dnd-kit/react styled-components`.

APIs used: `WaveformPlaylistProvider`, `Waveform`, `usePlaylistControls`, `usePlaylistData`, `useExportWav`, and `resumeGlobalAudioContext`. The adapter owns manifest mapping; upstream objects and URLs never enter persisted JSON.

## Manifest and lifecycle findings

- Manifest v1 is strict Zod-validated data with integer milliseconds, bounded dB gain, pan, explicit version/engine compatibility, unique stable IDs/order, and canonical sorting.
- A load/export round trip is deep-equal. Promoted mutations preserve unrelated fields and stable track/asset identity.
- The adapter constructs decode/audio resources only after the explicit open action. Playback separately resumes the shared audio context from a play gesture.
- Disposal is idempotent, closes the owned decode context once, detaches the runtime bridge, and rejects later calls with a typed error.
- Two generated PCM fixtures are 176,444 bytes each. Their decoded mono Float32 payload is approximately 705,600 bytes total (`2 tracks × 2 seconds × 44,100 samples × 4 bytes`), excluding browser/editor overhead.
- Fixture generation and redistribution provenance are documented; no upstream demo media is used.

## Build and bundle evidence

`npm run build` passed and listed `/__spikes__/studio` as a dynamic route. Content inspection found the editor/Tone implementation in four lazy chunks totaling 1,006,520 raw bytes (569,024 + 342,655 + 79,322 + 15,519). None of those chunk names occurs in the public home client-reference manifest, so the measured editor-code delta for `/` is zero. The public-route E2E request log also contained no Waveform Playlist/Tone markers or fixture audio.

The studio shell requests no fixture audio before `Open studio`; the authenticated Chromium test observed exactly two fixture requests after opening. No standalone worker or worklet asset was emitted or requested for the promoted path. No CSP, COOP, COEP, CORS, media, connect, or worker policy change was required. The two public WAV fixtures use the framework static-file response path and decoded successfully.

The raw lazy payload is material but below the spike's unexplained multi-megabyte threshold. PR 09 should remeasure compressed transfer and interaction timing on Preview rather than treating local development timings as a budget.

## Verification results

| Check                                   | Result                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Baseline `npm run check` before changes | Passed: 22 tests and production build                                                                                        |
| Focused manifest/mapping/adapter tests  | Passed: 20 tests                                                                                                             |
| Disabled/public Chromium E2E            | Passed: disabled route 404; public route no editor/audio requests                                                            |
| Enabled authenticated Chromium E2E      | Passed: lazy load, decode, play, pause, seek, mute, position, third track, save/reload, non-empty WAV export, no page errors |
| Production build / SSR boundary         | Passed                                                                                                                       |
| Chrome/Edge desktop perceptual timing   | Pending human audible check; Chromium structural automation passed                                                           |
| Firefox desktop                         | Pending human/browser environment                                                                                            |
| Safari desktop                          | Pending; owner: PR 09 implementer with macOS access                                                                          |
| Vercel Preview HTTPS                    | Pending deployment authority/configured Vercel access                                                                        |
| Standalone `agent-browser` visual check | Unavailable: CLI is not installed; equivalent Playwright Chromium checks passed                                              |

Commands used include `npm run check`, `npm run test:e2e`, the enabled local `npx playwright test tests/e2e/studio-spike.spec.ts -g "authenticated spike" --workers=1`, `npm run build`, `git diff --check`, and the package/bundle inspection commands documented above. Local Auth verification used a clean database reset and the gated `.test` actor. No service-role credential is used by application studio code.

## Preview verification commands

With deployment authority, set `ENABLE_STUDIO_SPIKE=true` only on a Vercel Preview, authenticate a completed invited profile, and visit `/__spikes__/studio`. Run the same interaction matrix over HTTPS and inspect chunk/audio MIME and cache headers, console errors, hard-refresh restoration, cleanup after route-away, and public-route requests. Production must leave the flag false; the route additionally rejects production environments that are not Vercel Preview.

## Known limitations and PR 09 work

- The spike has purpose-built controls, not production studio UX or mobile support.
- Local persistence is test-only `localStorage`; production autosave, Supabase project/asset records, signed URLs, quotas, uploads, revisions, and contributions remain deferred.
- Perceptual synchronization, audible latency, repeated browser heap/listener profiling, compressed Preview transfer, Firefox/Safari behavior, and HTTPS headers need the manual/Preview matrix above.
- The provider's supported React surface is retained; no OpenDAW, recording, MIDI, effects, annotations, spectrograms, WAM, or automatic audio merging is introduced.
