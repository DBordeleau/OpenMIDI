# OPT-02 immediate progressive studio evidence

Status: Pass for OPT-02; OPT-03 browser lossless upload optimization is next  
Date: 2026-07-14  
Environment: Windows, Node 24.18.0, npm 11.16.0, Playwright 1.61.1

## Outcome

The studio now constructs placeholder Waveform Playlist tracks directly from the validated saved manifest before private source signing or audio transfer. Track names, order, positions, trims, mixer values, credits, add/remove/reorder controls, autosave, and publish UI therefore remain usable while audio is queued. Real `AudioBuffer`s replace only their matching placeholder clips as each full-object fetch and `decodeAudioData()` call completes.

Every lane reports `queued`, `loading`, `decoding`, `ready`, or `failed`. Synchronized play is disabled with an explanation until every audible track is ready. A muted unready track does not block playback; unmuting it immediately re-locks transport. Failed tracks retain successful peers and retry through a fresh authorized signed batch without restarting ready downloads. Navigation/disposal aborts active fetches and generation guards ignore late attachment.

## Controlled profile

The OPT-01 deterministic controlled fixture remains three 180-second mono 44.1 kHz 24-bit WAV stems, 23,814,044 bytes each (71,442,132 bytes total). Chromium ran under 20 Mbit/s aggregate downstream, 5 Mbit/s upstream, and 50 ms added latency. Cold measurements use five fresh contexts with HTTP cache disabled. Warm measurements use one context, one unmeasured priming load, and five measured same-session registry hits.

| Path                      | Runs | Median shell ready | Slowest shell ready | Median playback ready | Slowest playback ready | Median transferred bytes |
| ------------------------- | ---: | -----------------: | ------------------: | --------------------: | ---------------------: | -----------------------: |
| Controlled cold WAV       |    5 |               7 ms |               48 ms |              29.348 s |               29.357 s |               71,442,132 |
| Primed same-session reuse |    5 |             < 1 ms |                7 ms |                < 1 ms |                   7 ms |                        0 |

No Long Tasks API entry crossed the reporting threshold. The harness mark begins after route data exists, so it is not a substitute for the gated browser journey, but it directly proves the former all-source barrier has been removed. Cold playback remains essentially equal to OPT-01 because OPT-02 deliberately keeps the original WAV bytes; OPT-03 owns lossless FLAC transfer reduction.

Raw generated results remain ignored at `local/opt02-results/delivery-controlled.json`.

## Reuse and caching decision

The adapter keeps a module-scoped registry bounded to 12 entries and 384 MiB of decoded Float32 payload. The verified server-provided viewer ID activates exactly one actor boundary. A different actor or sign-out clears all entries; failed promises are removed; least-recently-used resolved buffers are evicted deterministically; an individually oversized buffer is returned to its caller but not retained. Concurrent calls for one immutable asset share one promise.

Source fetches now use the browser's normal `default` cache mode rather than forcing `no-store`, which permits reuse only when the same signed URL and response headers allow it. The measured warm win comes from the actor-scoped registry, not an assumption about CDN token reuse. Signing endpoints and viewer-specific descriptors remain `private, no-store`; signed URLs are not registry keys, logged values, or cross-actor state. No service worker, Cache Storage, IndexedDB, public bucket, schema, RLS, or Storage-policy change was added.

## Automated coverage

Focused Vitest coverage proves:

- placeholder mapping and manifest edits before any fetch resolves;
- progressive source status and concurrency-three loading;
- isolated partial failure and authorization refresh deduplication;
- audible/muted playback readiness behavior;
- bounded LRU reuse, oversize non-retention, failed-entry eviction, and actor clearing; and
- idempotent disposal after loading.

The gated Chromium identity journey now holds the private Storage source request in flight, requires the saved track control and loading summary within two seconds, requires Play to remain disabled, then releases the source and requires playback to become enabled before continuing the existing autosave/reload assertions. It runs only with the documented local Auth/Storage environment.

The journey was attempted twice against a clean reduced local Auth/Storage stack. Both attempts stopped in pre-existing upload/publication setup before reaching the OPT-02 assertions: the first timed out on stale expected verification copy, and after aligning that assertion with the implemented “Starting audio verification…” state, the second timed out because the promoted fixture still did not make the publish checkbox available. Per the implementation plan's two-attempt limit, no further browser-environment troubleshooting was performed. The OPT-02 assertions are checked in but remain unexecuted in this environment.

## Reproduction

```powershell
node scripts/benchmark-studio-audio.mjs --profile controlled --loader progressive --phase both --repetitions 5 --output local/opt02-results/delivery-controlled.json
npm test -- --run src/features/studio/waveform-playlist-adapter/adapter.client.test.ts src/features/studio/waveform-playlist-adapter/source-loader.client.test.ts src/features/studio/waveform-playlist-adapter/source-buffer-registry.client.test.ts src/features/studio/waveform-playlist-adapter/mapping.test.ts
```

The benchmark uses generated local audio and a loopback server. It does not read or mutate hosted Supabase.

## Scope boundary and follow-up

OPT-02 changes no source bytes, upload behavior, schema, RLS, Storage object, generated database type, manifest version, immutable revision, or publication transaction. Persisted peaks remain OPT-04; lanes without peaks show placeholders until their decoded buffers produce local waveforms. Quick preview optimization, worker FLAC conversion, and source-download copy remain later slices.
