# Production deployment

OpenMIDI's invite-only beta is hosted at `https://open-midi.vercel.app/` in the existing Vercel project `open-midi`, backed by the retained Supabase project `xjfynngyqywnllgotvcw`.

## Current production

- Application commit: `732d104`
- Production deployment: `dpl_2Mc9qAVYT7QUKS26MUH8DnheCpvq`
- Verified preview source: `dpl_4ZhgCC45mFCr4Nj6wN41LB4E7PgT`
- Previous known-good deployment: `dpl_CGsF5VvPi7d5n8rSf3zmu7266LK3`

The application environment contains only the public Supabase URL/publishable key and exact `SITE_URL` needed by the browser/server application. Google OAuth secrets remain in Supabase/Google provider configuration, and service-role credentials are not Vercel application variables. `.vercel/`, local environments, dependencies, and generated build/test output are excluded from deployment uploads.

## Deploy and verify

1. Start from a clean reviewed commit and run `npm run check`.
2. Deploy a preview with `npx vercel deploy --yes`.
3. Inspect the exact preview deployment and run signed-out smoke. Complete account-scoped checks through an invited account at the approved origin.
4. Obtain explicit production approval naming the exact preview deployment.
5. Promote only that deployment, then verify `https://open-midi.vercel.app/` resolves to the resulting production deployment.
6. Check public routes, protected redirects, `/test-auth` returning 404, representative MIDI preview responses, and Vercel runtime errors/log status.

Merging code never deploys, changes Supabase, or grants authority to promote a preview.

## Rollback

For an application regression, preserve the forward-only database and run:

```powershell
npx vercel rollback dpl_CGsF5VvPi7d5n8rSf3zmu7266LK3 --yes
```

Verify the production alias and repeat the narrow smoke before reopening the beta. Do not roll back database migrations, rerun the RELEASE-01 destructive reconciliation, or delete seed lineage ad hoc. Provider rollback restores only previously recorded safe Site URL/redirect/OAuth values. Seed containment uses project visibility, library unlisting, challenge cancellation, or audited moderation from the beta operations runbook.
