# OPT-04 — Persisted waveform peaks

Date: 2026-07-14  
Scope: `OPT-04` only from the pre-invite audio-delivery optimization pass

## Outcome

New WAV uploads optimized by OPT-03 persist their already-generated waveform summary as a small private derivative. The derivative is never audio authority: source verification, immutable history, full-quality download/export, and manifest asset IDs are unchanged. Existing sources without peaks continue through the OPT-02 placeholder and decode path without backfill.

## Persisted contract

- `JSPK` binary format version 1, algorithm `pcm-minmax-v1`.
- Exact source UUID in the header plus channels, duration, sample rate, one 2,048-bin resolution, and signed 16-bit min/max pairs.
- 8,232 bytes for mono and at most 65,576 bytes for eight channels; the reservation ceiling remains 512 KiB.
- Server-generated private path: `{owner}/{source}/{derivative}/peaks.v1.bin`.
- Owner-only reservation/direct upload; a user-scoped server action downloads the small object, validates bytes and SHA-256, then calls the database finalizer.
- Finalization is idempotent, keeps source verification authoritative, and moves bytes from global derived reservation to actual derived usage without entering user source quota.

## Read and rendering path

Revision, workspace, and contribution-version audio-source routes return a peak descriptor only after their existing exact context authorization and only when derivative metadata matches the trusted ready source. The client validates the descriptor, digest and binary again, creates Waveform Playlist `waveformData`, and renders it while canonical audio remains in flight. Missing, stale, unauthorized, malformed, or corrupt data is ignored. Decoded source audio later replaces the coarse persisted summary for detailed zoom.

## Automated evidence

- Focused Vitest: binary round trip/rejection, descriptor/digest fallback, peaks-first mapping, progressive adapter regressions, and the OPT-03 codec contract.
- Focused pgTAP: 39 assertions covering owner coordination, exact path/source binding, malformed/oversized/version/content-type rejection, idempotency conflicts, global capacity, source-quota isolation, source-authority immutability, anonymous/unrelated/suspended denial, authorized project and fork reads, deleted project behavior, expiration, and derivative/source retention direction.
- Local Chromium upload journey: asserts canonical FLAC plus a finalized `JSPK` derivative before trusted source promotion.
- Local Chromium studio journey: verifies the real source and peak objects in Storage during fixture preflight, substitutes those exact bytes for the known-stalling local Windows/Docker signed response bodies, delays canonical source delivery, and asserts the accessible persisted-waveform state appears before real browser decode/playback readiness.

The fixture substitution is local test infrastructure only. Production code still fetches short-lived signed private URLs, and hosted/manual playback remains the authority for the real transport path. This boundary prevents agents from repeatedly spending the test retry budget on a diagnosed local Storage body-stream issue while preserving meaningful browser coverage above that transport.

Final command results are recorded in the OPT-04 implementation handoff.

## Deferred evidence

OPT-05 owns controlled five-run cold/warm performance measurement and rollout/capacity reporting. Automatic backfill of existing assets, owner-triggered later peak generation, lossy proxies, previews, and broad retention operations remain outside OPT-04.
