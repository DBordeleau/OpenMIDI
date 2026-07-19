# RELEASE-03 authorized hosted rollout

Date: 2026-07-19

Outcome: Invite-only beta deployed and production smoke accepted

## Exact targets

- Supabase project: `xjfynngyqywnllgotvcw` (retained; no replacement project)
- Production origin: `https://open-midi.vercel.app/`
- Vercel project: `dillon-bordeleaus-projects/open-midi`
- Verified rollout application commit: `732d104`
- Verified rollout preview: `dpl_4ZhgCC45mFCr4Nj6wN41LB4E7PgT`
- Verified rollout production deployment: `dpl_2Mc9qAVYT7QUKS26MUH8DnheCpvq`
- Production deployment immediately preceding that rollout: `dpl_CGsF5VvPi7d5n8rSf3zmu7266LK3`

These identifiers are historical RELEASE-03 rollout evidence, not permanent claims about the deployment currently serving production or a universal future rollback target.

No credential, token, signed URL, invitation email, private report, or Storage object path is recorded here.

## Migration preflight and ledger reconciliation

The read-only preflight confirmed that the hosted schema already implemented every reviewed migration while the linked ledger recorded only the first seven repository versions. After explicit authorization, the following nine versions were marked applied through migration-history repair only:

- `20260717220750`
- `20260717232107`
- `20260718063241`
- `20260718070409`
- `20260718171612`
- `20260718190737`
- `20260718202909`
- `20260718222256`
- `20260719010758`

No migration SQL was replayed, no schema object was changed, and the destructive RELEASE-01 reconciliation was not rerun. The final linked check reports the same 16 versions locally and remotely, from `20260717000001` through `20260719010758`, with no ledger-only or repository-only entry.

## Provider and deployment configuration

The existing Google Web OAuth client was retained. The operator added the exact Vercel origin to its approved origins, and the Supabase Site URL/redirect configuration targets the production origin. Vercel production and preview environment scopes use the retained Supabase project without exposing a service-role or Google client secret to the application.

The existing `process-profile-image` Edge Function remains active with JWT verification for the avatar-only flow. No musical Edge Function, musical bucket, source-audio system, sample, soundfont, or rendered-preview service exists. A public copyright/contact channel was not available during rollout and remains a required decision before unrestricted launch; the authenticated private copyright-report path remains active for the invite-only beta.

## Hosted beta seed

The curator/administrator actor `18fad7ad-1361-4766-8b32-23bb1032baed` was verified before mutation. Human listening accepted the seven pattern previews and three project previews. The authorized dry run reported 11 `CREATE` decisions with no conflict; the confirmed import created:

- 7 patterns: 4 commercially reusable CC BY 4.0 and 3 reference-only;
- 3 projects: Pocket Circuit, Neon Steps, and Windowlight Waltz; and
- 1 Four-Bar Spark challenge.

The post-import dry run reported all 11 items as `REUSE`, with zero `CREATE` and zero `CONFLICT`. The short-lived actor token was removed from the user-scoped environment after use.

## Production smoke

Automated and operator-assisted evidence covered:

- signed-out `/`, `/sign-in`, `/explore`, `/library`, and `/challenges` responses;
- authenticated feedback protection and production `/test-auth` returning 404;
- all seven library previews and all three seeded project previews using browser-local synthesis;
- administrator dashboard and controls;
- invited second-account contribution submission, owner review, acceptance, immutable attribution, and fork behavior;
- accepted revision 2 preview containing all three tracks and pattern versions;
- explicit Studio switching between a stale preserved owner draft and the latest accepted immutable revision;
- uninvited signup rejection without an Auth user being created;
- Four-Bar Spark discovery; and
- no musical Storage or legacy-audio behavior.

Two smoke defects were fixed and redeployed: strict public-project preview parsing now accepts the bounded `license` field, and Studio now identifies a draft whose base predates an accepted revision and offers a safe read-only latest-revision view without overwriting private work.

Immediately after final promotion, the production route matrix returned expected `200`, `307`, and `404` statuses; the representative accepted-revision preview returned revision 2 with 3 tracks and 3 pattern versions. Vercel reported no runtime error cluster.

The repository is connected to Vercel, so merging PR #66 into the configured production branch is expected to create a subsequent production deployment. The operator must wait for it, record its exact commit and deployment ID, confirm the production alias, and repeat the narrow route/preview/runtime-error smoke before treating the merged commit as production-verified. That application deployment does not mutate Supabase schema, data, migration history, Auth/provider configuration, or seed state.

## Verification

- Final `npm run check`: passed (114 test files, 369 tests, production build included).
- Focused Studio/session tests: 4 files and 14 tests passed before the full check.
- Vercel production build: passed with Next.js 16.2.10.
- Hosted migration list: 16 local and 16 remote versions, exact match.
- Local Supabase E2E rerun for the final Studio selector: unavailable because Docker Desktop was not running; the existing collaboration E2E was extended to cover stale draft → accepted revision → preserved draft and remains part of the next local/CI execution.

## Usage baseline

The post-smoke Supabase inspection reported a 21 MB database, 99% index hit rate, and 100% table hit rate. Current estimated domain counts were 4 projects, 5 revisions/arrangements, 8 MIDI patterns/versions, 7 library listings, 1 contribution/version, 1 challenge/version, 2 profiles, and 1 administrator. Storage remained limited to the two established avatar buckets with four previously recorded avatar objects. The only hosted function was the avatar processor. Vercel's initial production log sample contained no runtime error.

This remains a $0-budget MIDI-only beta baseline: structured MIDI lives in Postgres, synthesis and exports run in the browser, and there is no musical media egress.

## Rollback and deferred checks

Application rollback begins by listing deployments and inspecting both the current deployment and its preceding candidates. The operator must identify the exact previously verified deployment from the applicable release evidence, confirm its commit/environment/readiness, and only then run `npx vercel rollback <confirmed-previous-deployment-id> --yes`. Wait for completion, verify the production alias, and repeat narrow smoke. The historical rollout IDs above remain useful evidence but are not an automatic future rollback choice. Database history remains forward-only. Do not rerun RELEASE-01, reverse ledger repairs, or delete seeded lineage ad hoc.

Before unrestricted launch, approve and publish a public copyright/contact channel and repeat the account-scoped production smoke on the final launch candidate. Avatar upload/processing should also be manually repeated when an operator has a disposable image and intends to mutate avatar state.
