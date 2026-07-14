# OPT-03 browser lossless upload evidence

Status: Complete; focused Chromium upload and studio journeys pass after the local E2E harness repair
Date: 2026-07-14  
Environment: Windows, Node 24.18.0, npm 11.16.0, Next.js 16.2.10, Chromium via Playwright 1.61.1

## Implemented contract

New WAV selections now stop after preliminary signature/size validation and ask the musician to choose between browser lossless optimization and the original WAV. Optimization dynamically imports a narrow client wrapper, starts a dedicated module worker, and transfers the WAV buffer into that worker. The worker uses exact-pinned `mediabunny@1.50.8` plus `@mediabunny/flac-encoder@1.50.8`; no codec package is imported by a Server Component, server action, route handler, repository, shared schema, or studio server boundary.

The conversion observes each decoded `AudioSample` through Mediabunny's conversion `process` hook before returning the same sample to the FLAC encoder. A bounded 2,048-bin per-channel min/max summary is therefore generated from the same decoded PCM without a second source decode. The peak payload is transient in OPT-03: it is retained only through the upload completion state so OPT-04 can adopt the versioned contract without this slice creating a derivative object or relation early.

Before reservation, the wrapper validates:

- `fLaC` output signature and the 45 MiB output limit;
- source and output duration (1 ms–10 minutes), channel count (1–8), and sample rate (8–192 kHz);
- exact channel/sample-rate equality plus duration equality within two source samples;
- peak version, shape, finiteness, and normalized `[-1, 1]` values.

Only the validated `.flac` candidate is reserved and uploaded through the existing 6 MiB-chunk TUS path. Its base filename is preserved with an accurate `.flac` extension. The trusted source verifier remains responsible for ready-state signature, metadata, size, and SHA-256 authority. The selected WAV never receives an asset ID or Storage path. Original-WAV fallback is available when Worker/WASM is absent, the browser reports less than 4 GiB device memory, conversion is cancelled, allocation fails, or conversion/output validation fails. FLAC and MP3 selections bypass the optimizer and remain byte-identical upload candidates.

## Dependency and bundle evidence

Both new direct dependencies are exact pins and the lockfile is preserved. `THIRD_PARTY_NOTICES.md` records Mediabunny/MPL-2.0 and the embedded Xiph.Org libFLAC BSD-like license/source. The production build emits a lazy optimizer client chunk and a separate worker graph. Searching `.next/server` after `npm run check` found no `registerFlacEncoder` or `@mediabunny/flac-encoder` package code. The dynamic worker/client chunk IDs were absent from the application route build manifest, so they are not initial dependencies of `/uploads` or any non-upload route; selection of FLAC/MP3 also never evaluates the dynamic import.

## Automated verification

Passed:

- `npm test -- src/features/assets/browser-codec/contract.test.ts src/features/assets/schema.test.ts` — 2 files, 8 tests.
- Focused ESLint for the codec, upload component, export copy, and E2E specs.
- `npm run typecheck` during iteration.
- `npm run db:reset` against the reduced local Storage stack; all tracked migrations and seed applied cleanly. OPT-03 adds no migration, RLS policy, Storage policy, or generated database type.
- `npm run check` — formatting, lint, typecheck, 34 Vitest files/119 tests, and the production build all passed.
- `git diff --check` during review.

The unit contract covers valid signature/metadata/peaks, signature mismatch, duration/channel/sample-rate mismatch, malformed/out-of-range peaks, unsupported Worker/WASM, low reported memory, generated filename accuracy, source limits, and byte-identical FLAC/MP3 passthrough. OPT-01's unchanged exact codec versions previously passed dedicated-worker progress, cancellation, FLAC signature/container metadata, Chromium/Firefox decode, exact first-10,000-sample PCM comparison, and the 590-second boundary fixture.

## Chromium journey status

`tests/e2e/audio-upload-optimization.spec.ts` now describes the complete local journey: cancel conversion before reservation, fail a deceptive WAV before reservation, convert the tracked two-second WAV, upload only its FLAC object, invoke the trusted local verifier, assert ready FLAC metadata, and compare every browser-decoded sample with the WAV (`maxDelta = 0`). It inspects application rows and private Storage as the authenticated owner; service-role access is limited to the existing verifier script.

The original OPT-03 validation was attempted twice and then stopped under the repository's environment-dependent retry ceiling:

1. The first run checked onboarding before the test-auth server-action redirect settled and later timed out waiting for the upload input on the sign-in page. The spec now waits for navigation away from `/test-auth`.
2. The second run reached the spec but its initial evidence query used direct `service_role` table SELECT, which this repository intentionally revokes. The spec now signs in a separate owner-scoped client for row/Storage evidence. The corrected journey was not rerun because the two-attempt ceiling had been reached.

The independent `npm run test:e2e:studio` regression was also attempted twice. The first start was blocked by the stale Next dev process left by the timed-out upload run. After that repository-local process was removed, the journey rendered the manifest-first studio but its pre-existing WAV fixture remained in `loading` for 30 seconds.

## Post-OPT-03 harness repair

The local gated runner now owns one isolated Next dev process at a time, uses `.next-e2e` instead of competing for the interactive `.next` lock, verifies port availability before launch, and terminates the complete process tree after success, failure, or interruption. A stale isolated lock is removed only when the test port is free. Playwright skips its own `webServer` when invoked through this runner, preventing nested servers and orphaned processes.

The upload journey has a dedicated `npm run test:e2e:upload` command. Its owner-scoped Storage download now occurs after the trusted verifier promotes the asset to `ready`, matching the source-read policy rather than incorrectly expecting a `processing` object to be readable. The shared verifier module also avoids TypeScript parameter-property syntax so the documented Node 24 operator command can execute it directly.

The studio fixture confirms the seeded Storage source is downloadable with the expected byte length before the browser starts. A later OPT-04 harness repair also verifies the persisted peak object and hash. Because local Windows/Docker signed-object responses can deliver HTTP 200 headers while stalling their bodies, the browser still calls the real authorized descriptor/signing endpoint and the harness verifies its exact private source/peak paths, then rewrites only those fixture delivery URLs to a test-owned loopback server. That server returns the exact preflight-verified peak bytes immediately and delays the exact source bytes by 1.5 seconds. This keeps real descriptor authorization, persisted-peak hydration, Web Audio decoding, playback readiness, autosave, and reload coverage without treating the local Storage transport as product evidence. The readiness assertion uses the user-visible playback control rather than an impossible exact-text match against a status element that also contains screen-reader copy.

Fresh focused validation passed on 2026-07-14:

- `npm run test:e2e:upload` — 1 Chromium test passed in 11.3 seconds.
- `npm run test:e2e:studio` — 1 Chromium test passed in 10.3 seconds after the final loopback-delivery harness repair.

The repository retry ceiling now distinguishes an unchanged environment failure from a concrete test, fixture, selector, query, or harness defect. Fixing a diagnosed defect permits one focused validation run; repeatedly rebuilding the same broken prerequisite state remains prohibited.

## Manual and deferred evidence

Safari/macOS worker conversion, browser task-manager peak memory, audible listening, and screen-reader/reduced-motion checks remain manual release checks. The original-WAV fallback stays visible because those checks are not inferred from Chromium. Persisting, authorizing, reading, and retaining peak derivatives is exclusively OPT-04. Controlled three-stem cold/warm playback measurement and any preview follow-up remain OPT-05.

## Rollout and rollback

OPT-03 has no migration ordering. Deploy the application after OPT-02; the optimizer is already capability- and explicit-choice-gated. A rollout may additionally hide the optimization choice without affecting original WAV/FLAC/MP3 admission. Rollback removes new conversion while every already verified FLAC remains an ordinary supported immutable source. Apply the future OPT-04 migration before deploying any client that uploads or finalizes persisted peaks.
