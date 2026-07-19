# RELEASE-02 seeded beta and release hardening

Date: 2026-07-18
Outcome: Complete in the repository; hosted seed import and deployment remain deferred

## Seed content and rights basis

The versioned `release-02-beta-content.json` fixture contains three compact, original manifest-v3 projects, seven exact pattern versions, and one approachable administrator-curated challenge. Four patterns are listed for commercial reuse under CC BY 4.0. Three patterns are intentionally reference-only so the beta library demonstrates listening and inspection without granting save, import, fork, edit, or export rights. Pocket Circuit remains the CC BY forkable example and embeds only commercially reusable patterns; Neon Steps and Windowlight Waltz are all-rights-reserved, so their reference-only pattern dependencies cannot be copied through a project fork. The fixture schema enforces that every CC BY project track resolves to a commercial-reuse pattern. The fixture records the operator's original-work attestation and the expected canonical manifest and challenge-constraint hashes.

The content is deterministic and uses bundled synthesis presets only. It contains no uploaded audio, samples, soundfonts, rendered previews, remote synthesis assets, external credits, real hosted identifiers, email addresses, project references, credentials, or secrets.

## Import and dry-run behavior

`npm run seed:beta -- --actor-id <administrator-profile-uuid>` is the default no-mutation path. It authenticates a supplied administrator/curator access token, verifies that the token belongs to the exact supplied actor, checks the actor's public active profile and administrator authority, then reports `CREATE`, `REUSE`, or `CONFLICT` for every pattern, project, and challenge.

Mutation requires both `--execute` and `--confirm RELEASE-02-BETA-v1`. The importer uses existing authenticated RPCs and stable request IDs. Exact existing content is reused, incomplete exact imports resume, and name or hash mismatches stop as conflicts. It does not use a service-role credential or mutate Storage, Auth provider settings, deployment configuration, or any hosted service by itself.

A clean local rehearsal with a synthetic administrator produced 11 `CREATE` decisions before execution, reported the corrected 4-commercial/3-reference mapping and all-rights-reserved/CC BY project licenses, imported seven patterns, three projects, and one challenge, then produced 11 exact `REUSE` decisions on the next dry run.

## Release hardening

- The public library exposes compact examples for both rights modes with actionable reuse language and browser-local MIDI previews.
- The Four-Bar Spark challenge presents a frozen schedule, concise constraints, eligibility language, and reporting affordance.
- The account-unavailable route now explains likely authorization causes and offers pill-shaped sign-out and return-home actions.
- Shared button motion explicitly respects reduced-motion preferences, and stale project visibility copy now uses current MIDI/Studio terminology.
- The beta operations runbook covers invitations, moderation, copyright reports, feedback triage, challenge operation, seed import, rollback or disable procedures, and incident response.

## Verification

- Focused release fixture and project-action tests: 6 passed.
- Type checking and focused lint: passed.
- Default importer invocation without credentials: exited without mutation.
- Clean `npm run db:reset`: all 16 reviewed migrations and the deterministic seed applied.
- `npm run db:check`: release reconciliation rehearsal, database lint, 28 pgTAP files with 905 assertions, and generated-type drift check passed.
- `npm run test:e2e:local`: identity/onboarding/project, Studio create/save/reload/publish/export, contribution review/acceptance/attribution, and fork lineage passed (3 passed, 1 intentionally skipped).
- Real Chromium browser check at 320 px: the seeded library, Four-Bar Spark challenge, and account-unavailable route had no horizontal overflow. Keyboard activation reached the Neon Pocket preview and produced no console error.
- The final `npm run check`, standalone `npm run build`, and `git diff --check` results are recorded in the pull request.

## Manual playback result and limitation

The browser-local preview was activated by both pointer click and keyboard Enter in a real Chromium user gesture, with the expected preview control remaining operable and no console error. This agent environment exposes browser state but no audible output, so it cannot honestly certify the perceptual sound quality. A human operator must listen to the seeded patterns on a MIDI-capable browser before importing them into the retained hosted project; the runbook includes that stop condition.

## Operational boundary

No hosted Supabase project, hosted data, OAuth provider, Vercel project, deployment configuration, DNS record, Edge Function, or production service was inspected or mutated during RELEASE-02. All database and import rehearsals used the disposable local Supabase stack. The $0-budget MIDI-only boundary remains intact: the delivered path adds no musical Storage, audio pipeline, media processor, hosted preview, new hosted service, or remote synthesis dependency.
