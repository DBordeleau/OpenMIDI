# OPT-05 audio-delivery measurement and rollout

Status: Complete; the studio shell gate passes and optimized cold playback remains byte-bound  
Date: 2026-07-14  
Environment: Windows, Node 24.18.0, npm 11.16.0, Playwright Chromium 149

## Outcome

The final controlled pass keeps the OPT-02 manifest-first shell below the required two seconds and reduces cold three-stem playback readiness from 29.267 seconds for WAV to 17.709 seconds for browser-generated FLAC. Same-session actor-scoped reuse transfers no bytes and makes both paths ready in under 5 ms in the harness.

The FLAC path does not meet the 8–12 second cold target. This is a byte limit rather than a hidden loading barrier: the controlled FLAC set is 42,694,867 bytes, whose transfer alone has a 17.078-second floor at 20 Mbit/s before latency and decode. The observed 17.709-second median is 631 ms above that physical floor. Lossy proxies remain unimplemented; a separate future decision is required before any proxy work.

## Exact browser-generation contract

`scripts/generate-studio-flac-fixtures.mjs` refuses to run unless the production dependencies remain pinned exactly to `mediabunny@1.50.8` and `@mediabunny/flac-encoder@1.50.8`. Its Chromium module worker uses the production encoder shape: `FlacOutputFormat`, forced audio transcode, and the same `AudioSample` process callback that accumulates 2,048-bin per-channel min/max peaks before returning each sample to the encoder.

For every generated fixture, the harness requires:

- a `fLaC` signature;
- exact channel and sample-rate equality plus duration equality within two source samples;
- browser decode of the WAV and FLAC to the same channel count, sample rate and frame count; and
- zero delta for every decoded PCM sample.

The three controlled stems matched across all 23,814,000 compared samples. Browser conversion took 1.792 seconds in total, including 315 ms measured inside the same-PCM peak accumulator. No second production decode is used to generate peaks.

All ratios below are controlled results for deterministic synthetic tones, transients and noise. They are not representative compression promises for recorded music; FLAC size depends on the source material.

## Controlled five-run results

Chromium used 20 Mbit/s aggregate downstream, 5 Mbit/s upstream and 50 ms added latency. Cold runs used five fresh contexts with cache disabled. Warm results used one context, one unmeasured prime, then five measured registry hits. The local mark begins after route data is available, so the targeted studio E2E remains the route-level shell assertion.

| Source       |      Bytes |                 Controlled ratio | Median shell | Slowest shell | Median playback | Slowest playback |                Warm playback | Warm bytes |
| ------------ | ---------: | -------------------------------: | -----------: | ------------: | --------------: | ---------------: | ---------------------------: | ---------: |
| Original WAV | 71,442,132 |                             100% |         5 ms |         50 ms |        29.267 s |         29.301 s | < 1 ms median / 4 ms slowest |          0 |
| Browser FLAC | 42,694,867 | 59.76% retained / 40.24% smaller |         5 ms |         49 ms |        17.709 s |         17.755 s | < 1 ms median / 5 ms slowest |          0 |

No delivery run reported a Long Tasks API entry above its threshold. That does not replace a browser task-manager memory check or perceptual listening check.

## Stress and boundary capability

These are one-run capability observations, not medians.

| Profile            |    WAV bytes / playback |  FLAC bytes / playback | Controlled ratio | Browser conversion | Same-PCM peaks |                      PCM proof |
| ------------------ | ----------------------: | ---------------------: | ---------------: | -----------------: | -------------: | -----------------------------: |
| 12 × 180 s stems   | 285,768,528 / 116.869 s | 180,474,516 / 73.605 s |  63.15% retained |            8.537 s |        1.575 s | 95,256,000 samples, zero delta |
| 1 × 590 s boundary |   37,760,044 / 16.392 s |   14,783,889 / 7.146 s |  39.15% retained |            1.324 s |         247 ms | 18,880,000 samples, zero delta |

Shell readiness remained 65 ms or less for the stress run and 84 ms or less for the boundary run. The 12-stem result shows that progressive presentation remains usable while full-quality playback is still constrained by aggregate bytes and connection speed.

## Proxy and audio-preview decisions

The cold target cannot be reached by implementation tuning alone for this controlled FLAC byte count. A future client-generated lossy proxy proposal would need a separate product/architecture decision proving encoder delay and cross-browser alignment, private authorization, capacity and retention accounting, canonical-source use for download/export, codec licensing, and fallback behavior. No proxy is approved or implemented by OPT-05.

The existing latest-revision audio preview still signs, fetches and decodes its complete source set. A stored browser-produced audio mix preview is also deferred as a separate future audio-preview delivery slice. It requires explicit immutable revision linkage, derivative lifecycle and quota accounting, source-derived authorization and retention, and an atomic publication/failure contract. It is not part of MIDI-05: that slice owns MIDI-native schedule/preset playback and does not solve legacy audio preview delivery.

## Free-tier monitoring and response

Current Supabase documentation lists Free-plan organization quotas of 1 GB Storage and 5 GB egress. Storage quota is measured as GB-hours averaged over the billing period, so deleting late in a cycle may not immediately remove a restriction. Private buckets continue to require RLS-authorized downloads or time-limited signed URLs. Smart CDN is a paid-plan feature, and each signed token has an independent cache identity; the rollout therefore does not assume a Free-plan shared CDN win or reuse signed URLs across actors.

Until PR 18 adds actual-object reconciliation, Jam Session's database gate counts registered ready/reserved source and peak-derivative bytes, warns at 750 MiB and rejects a reservation above 850 MiB. It does not yet reconcile every snapshot, avatar, orphan or cleanup-lag object. The operator must:

1. inspect organization Storage and egress in the Supabase usage dashboard before enabling a cohort, weekly during the invite period, and before any large fixture batch;
2. pause new audio admission and invitations at the application warning, any provider quota alert, or unexplained drift—whichever happens first;
3. use the existing dry-run `npm run assets:cleanup` only to inspect eligible failed uploads; never delete referenced canonical sources to recover capacity; and
4. require PR 18's reviewed actual-object summary and reference-aware cleanup before relying on automated reconciliation.

The controlled 42.7 MB FLAC project consumes about 0.043 GB per complete cold load before protocol/other application egress, so the provider's 5 GB allowance is operationally material even for a small cohort. Same-session registry reuse avoids duplicate transfer, but it is not persistent or cross-actor caching.

Official references checked on 2026-07-14:

- [Supabase billing quotas](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Storage size usage and GB-hour behavior](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size)
- [Private bucket access](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Signed URL and Smart CDN caching](https://supabase.com/docs/guides/storage/cdn/smart-cdn)
- [Supabase breaking-change changelog](https://supabase.com/changelog?tags=breaking-change) — no current Storage delivery change altered this pass

## Reproduction

```powershell
node scripts/generate-studio-audio-fixtures.mjs --profile controlled
node scripts/generate-studio-flac-fixtures.mjs --profile controlled
node scripts/benchmark-studio-audio.mjs --profile controlled --format wav --loader progressive --phase both --repetitions 5 --output local/opt05-results/delivery-controlled-wav.json
node scripts/benchmark-studio-audio.mjs --profile controlled --format flac --loader progressive --phase both --repetitions 5 --output local/opt05-results/delivery-controlled-flac.json
```

Use `stress` or `boundary` for the one-run capability profiles and `--phase cold --repetitions 1` for delivery. All generated media and raw JSON remain ignored under `local/`; the scripts use loopback only and do not read or mutate Supabase.

## Remaining manual release evidence

Safari/macOS conversion and decode, browser task-manager peak memory, audible lossless-quality listening, screen-reader announcements, and hosted private Storage timing remain manual release checks. No hosted migration, object, quota counter, deployment or feature flag was changed by OPT-05.

## Completion verification

- `npm run check` passed: formatting, zero-warning lint, type checking, 36 Vitest files / 124 tests, and the Next.js 16.2.10 production build.
- The production output contains no `registerFlacEncoder` or `@mediabunny/flac-encoder` implementation in `.next/server`.
- `npm run db:reset` applied every migration and seed against the clean local Storage stack.
- `npm run db:check` passed database lint, all 508 pgTAP assertions, and generated-type drift checking.
- `npm run test:e2e:upload` passed its targeted Chromium conversion/fallback/peak journey.
- `npm run test:e2e:studio` passed in 10.3 seconds after a post-OPT-05 harness repair. The first two OPT-05 attempts correctly stopped when the in-page and Playwright-route substitutions both left fixture delivery in `loading`. The final repair keeps the real authorized descriptor/signing request and exact private-path assertions, but serves the Storage-preflighted peak/source bytes through a test-owned loopback server with delayed source delivery. Persisted peaks, browser decode/playback readiness, autosave, and reload all completed.
