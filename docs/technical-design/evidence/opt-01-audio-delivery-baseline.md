# OPT-01 audio-delivery baseline and codec feasibility

Status: Pass for OPT-01; OPT-02 progressive loading is next  
Date: 2026-07-14  
Environment: Windows, Node 24.18.0, npm 11.16.0, Playwright 1.61.1

## Decision

Use `mediabunny@1.50.8` plus `@mediabunny/flac-encoder@1.50.8` as the pinned implementation candidate for OPT-03. Keep both packages absent from the application dependency graph until that slice adds a dedicated, dynamically loaded upload worker, fallback, notices, and bundle-boundary tests.

The candidate passed worker conversion, progress, cancellation, FLAC signature, container metadata, browser decode, and sample-exact round-trip checks in Chromium 149 and Firefox 151. The near-limit 590-second fixture also passed in Chromium. Browser heap telemetry was unavailable, and Safari/macOS was not available; OPT-03 must retain capability/failure fallback to the original WAV and must measure its actual lazy worker chunk and peak memory before enabling conversion by default.

`libflacjs@5.4.0` was not selected. It is an older all-in-one Emscripten surface (last published in 2020), its package warns that its WASM output is not binary-identical to other variants, and its unpacked package is about 8.0 MB. Full FFmpeg distributions remain outside the approved focused-codec architecture.

## Re-anchored production baseline

The implementation baseline is commit `50d0567`, after the plan's original `5aaf7e0` anchor. Inspection confirmed:

- `source-loader.client.ts` fetches every signed source with `cache: "no-store"`;
- every response is fully materialized with `arrayBuffer()` before `decodeAudioData()` can resolve;
- at most three sources fetch/decode concurrently;
- `WaveformPlaylistStudioAdapter.load()` resolves only after the whole source group, then constructs every editor track;
- `StudioSurface` withholds the provider, arrangement controls, waveform lanes, and playback until that group resolves; and
- quick preview has its own complete-source fetch/decode path.

This matches the Web Audio contract: `decodeAudioData()` consumes complete file data rather than fragments. Private source delivery remains based on authorized, short-lived signed URLs; no signed URL or audio byte is persisted by this slice.

## Deterministic fixtures

`scripts/generate-studio-audio-fixtures.mjs` now preserves the two small tracked smoke fixtures and adds ignored `controlled`, `stress`, and `boundary` profiles. The generated sources contain only deterministic synthesized tones/transients/noise and no third-party media.

| Profile    | Shape                                     |                             Bytes | Purpose                                 |
| ---------- | ----------------------------------------- | --------------------------------: | --------------------------------------- |
| Controlled | 3 × 180 s, mono 44.1 kHz, 24-bit PCM WAV  | 23,814,044 each; 71,442,132 total | Five-run controlled path                |
| Stress     | 12 × 180 s, mono 44.1 kHz, 24-bit PCM WAV |                 285,768,528 total | Maximum stem-count capability           |
| Boundary   | 1 × 590 s, mono 32 kHz, 16-bit PCM WAV    |                        37,760,044 | Near-10-minute accepted-size capability |

Controlled SHA-256 values are:

- `stem-01.wav`: `9e81c8c37178bb7249131b417528a9472c193eb8b31406e79e4d4b51e100c6bc`
- `stem-02.wav`: `4c43e8b736c293e2b6603c7348829b2c31317a3ecb05a6e6ad3c5f9d68a002d0`
- `stem-03.wav`: `aa554a8a13baaedbf1189901a83e7e2983d4f2fdc339e31374fba3dd4fd4eb64`

Generated media and raw JSON results stay under ignored `local/`; only this bounded evidence is tracked.

## Current delivery measurements

The reproducible harness in `scripts/benchmark-studio-audio.mjs` applies 20 Mbit/s aggregate downstream, 5 Mbit/s upstream, and 50 ms latency through Chromium DevTools network emulation. It follows the current concurrency-three, `no-store`, full-buffer, full-decode algorithm. Controlled cold runs use fresh contexts with cache disabled; warm runs repeat in one context with cache enabled, while the application fetch option remains `no-store`.

The harness starts after source authorization/signing, so its shell value is a lower bound for full route-to-shell time. In current production code shell, waveform, and playback readiness share the same all-sources-complete gate; the three recorded values therefore intentionally match.

| Profile                        |      Repetitions | Median shell/playback ready |   Slowest | Bytes per run |
| ------------------------------ | ---------------: | --------------------------: | --------: | ------------: |
| Controlled cold                |                5 |                    29.352 s |  29.373 s |    71,442,132 |
| Controlled same-session repeat |                5 |                    29.336 s |  29.340 s |    71,442,132 |
| Stress cold                    | 1 capability run |                   116.919 s | 116.919 s |   285,768,528 |
| Boundary cold                  | 1 capability run |                    16.322 s |  16.322 s |    37,760,044 |

No Long Tasks API entry exceeded the reporting threshold in the harness. This does not establish a full rendered-studio main-thread result. The controlled decoded mono Float32 payload alone is 95,256,000 bytes, before compressed response buffers, editor state, canvases, and browser overhead.

The baseline misses the two-second shell gate by construction and shows no useful warm reuse. OPT-02 must split manifest/shell construction from source readiness; later session reuse must remove duplicate transfer/decode without weakening the actor boundary.

## Development timing marks

Development builds now emit User Timing marks without URLs, paths, filenames, labels, or asset IDs:

- `openmidi:studio:route-start`
- `openmidi:studio:adapter-mounted`
- `openmidi:studio:shell-ready`
- `openmidi:studio:source-fetch-start` / `source-fetch-end`
- `openmidi:studio:source-decode-start` / `source-decode-end`
- `openmidi:studio:peaks-ready`
- `openmidi:studio:playback-ready`

Repeated source marks carry only a zero-based source index. At the baseline, shell/peaks/playback marks coincide; OPT-02 and OPT-04 will separate them. Production builds emit none of these marks.

## Codec measurements

The disposable packages were installed only beneath ignored `local/opt01-codec-spike`. `scripts/benchmark-flac-codec.mjs` runs conversion and 2,048-bin min/max peak generation in a dedicated module worker, transfers the output, cancels a second conversion, inspects FLAC container metadata, and decodes the result for a sample comparison.

| Browser / fixture         |  Encode | Peak scan |       Output |  Ratio | Round trip                                          | Cancel |
| ------------------------- | ------: | --------: | -----------: | -----: | --------------------------------------------------- | ------ |
| Chromium 149 / controlled | 0.661 s |   0.031 s | 14,006,707 B | 58.82% | exact first 10,000 samples; 180 s / 1 ch / 44.1 kHz | passed |
| Firefox 151 / controlled  | 2.618 s |   0.031 s | 14,006,707 B | 58.82% | exact first 10,000 samples; 180 s / 1 ch / 44.1 kHz | passed |
| Chromium 149 / boundary   | 1.385 s |   0.035 s | 14,783,889 B | 39.15% | exact first 10,000 samples; 590 s / 1 ch / 32 kHz   | passed |

Every output began with `fLaC`. The two unminified ESM bundles used by the isolated spike total 1,672,209 raw bytes and 333,765 gzip bytes. This is not a production tree-shaken chunk measurement; OPT-03 must prove the codec is absent from server and non-upload graphs.

The browser did not expose reliable worker heap telemetry. A conservative boundary lower bound is about 128 MB for input WAV + one Float32 PCM representation + FLAC output, excluding WASM memory, conversion pipeline buffers, and browser overhead. The boundary run completed without a crash, but constrained-device fallback remains mandatory.

Playwright WebKit 26.5 on Windows did not expose `AudioContext`, so it cannot validate the supported Safari studio path. Safari/macOS conversion/decode and a browser task-manager peak-memory observation remain explicit OPT-03 manual checks.

## Licensing and private-delivery review

Mediabunny and its FLAC extension are MPL-2.0. The extension bundles a size-optimized libFLAC WASM encoder. If OPT-03 adopts the packages, pin both exact versions, preserve their MPL source headers/license, add Mediabunny and upstream libFLAC attribution/license text to `THIRD_PARTY_NOTICES.md`, and do not modify bundled library files without satisfying MPL source obligations.

Official Supabase documentation continues to require authenticated access or time-limited signed URLs for private buckets. It also documents that each unique signed token has an independent CDN cache entry and that upload `cacheControl` is separate from token expiry. Therefore this slice makes no cache/header change; OPT-02 may test same-session reuse, but must not share signed URLs across actors or make source Storage public.

References:

- [Mediabunny FLAC encoder](https://mediabunny.dev/guide/extensions/flac-encoder)
- [Mediabunny supported formats/codecs](https://mediabunny.dev/guide/supported-formats-and-codecs)
- [Web Audio `decodeAudioData`](https://www.w3.org/TR/webaudio-1.0/#dom-baseaudiocontext-decodeaudiodata)
- [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase signed URL/CDN caching](https://supabase.com/docs/guides/storage/cdn/smart-cdn)

## Reproduction

From the repository root:

```powershell
node scripts/generate-studio-audio-fixtures.mjs --profile controlled
node scripts/benchmark-studio-audio.mjs --profile controlled --repetitions 5
npm install --prefix local/opt01-codec-spike --no-package-lock --ignore-scripts --no-save mediabunny@1.50.8 @mediabunny/flac-encoder@1.50.8
node scripts/benchmark-flac-codec.mjs --browser chromium --fixture controlled
node scripts/benchmark-flac-codec.mjs --browser firefox --fixture controlled
node scripts/benchmark-flac-codec.mjs --browser chromium --fixture boundary
```

Stress and boundary delivery capability runs use `--profile stress --phase cold --repetitions 1` and `--profile boundary --phase cold --repetitions 1`. These commands create only ignored local media/results and do not contact or mutate Supabase.

## Scope and next work

OPT-01 changes no schema, RLS policy, generated database type, Storage object, upload behavior, persisted manifest, source bytes, or production caching. OPT-02 owns manifest-first rendering, per-track readiness, progressive attachment, cancellation/retry, and bounded actor-scoped in-session reuse. OPT-03 owns dependency adoption and browser WAV-to-FLAC behavior.
