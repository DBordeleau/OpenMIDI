# Source-audio verification

> **Superseded — do not execute:** PIVOT-08 removed this worker, its jobs, network/cron extensions, buckets, secrets, and commands. This file is retained only as pre-pivot operational evidence and is not current setup or deployment guidance.

PR 11.5 automatically verifies every completed source upload. Browser audio bytes still travel directly to the private `source-audio` bucket; Next.js sends only the asset ID to the region-pinned `verify-source-audio` Edge Function.

## Runtime flow

1. `complete_source_upload()` confirms the exact Storage object size, moves the asset to `processing`, and inserts one private verification job in the same transaction.
2. The user-scoped Server Action immediately invokes `verify-source-audio` in `us-west-2`.
3. The Edge Function validates the user JWT, claims a two-minute service-role lease, downloads the object once, verifies its byte signature and decoded metadata, computes full SHA-256, and atomically promotes or fails the asset.
4. Transient failures retry once after ten seconds. Two failed automatic attempts produce `dead`; the owner can restart verification after a 30-second cooldown without uploading again.
5. A minute cron checks indexed eligible work. It makes no HTTP request while the queue is empty and recovers missed kicks or expired leases when configured.

The accepted limits remain WAV/FLAC/MP3, 45 MiB, ten minutes, 8–192 kHz, and one to eight channels. Client filename, MIME, duration, and extension are not trusted. Verification makes an asset `ready`; it becomes eligible for a workspace, contribution, or revision only after its owner explicitly confirms an ordered credit set containing at least one creator.

## Hosted deployment order

1. Apply `supabase/migrations/20260713070744_automatic_source_audio_verification.sql` to the hosted project.
2. Generate one high-entropy recovery secret. Set the exact same value as:
   - Edge Function secret `ASSET_VERIFICATION_RECOVERY_SECRET`;
   - Vault secret named `asset_verification_recovery_secret`.
3. Add these additional Vault values:
   - `asset_verification_recovery_url`: `https://<project-ref>.supabase.co/functions/v1/verify-source-audio?forceFunctionRegion=us-west-2`
   - `asset_verification_anon_key`: the hosted project’s legacy anon JWT used only to pass the Edge gateway. This is not the service-role key.
4. Deploy `supabase/functions/verify-source-audio/index.ts` with JWT verification enabled from `supabase/config.toml`.
5. Upload one small non-sensitive WAV and confirm `pending → leased → succeeded`, `assets.status = 'ready'`, the UI's separate `Credits required` state, and one invocation/Storage download.

Supabase automatically supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the deployed function. Do not manually expose them or place the service-role key in Vault/browser configuration. `ASSET_VERIFICATION_RECOVERY_SECRET` is the only custom Edge secret.

Example Vault setup in the hosted SQL editor, substituting values without committing or logging them:

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/verify-source-audio?forceFunctionRegion=us-west-2',
  'asset_verification_recovery_url'
);
select vault.create_secret('<hosted-anon-jwt>', 'asset_verification_anon_key');
select vault.create_secret('<same-high-entropy-secret>', 'asset_verification_recovery_secret');
```

Set the matching function secret with the Supabase dashboard or CLI, then deploy:

```powershell
npx supabase secrets set ASSET_VERIFICATION_RECOVERY_SECRET="<same-high-entropy-secret>" --project-ref <project-ref>
npx supabase functions deploy verify-source-audio --project-ref <project-ref>
```

## Operations

Queue health:

```sql
select state, count(*) from private.asset_verification_jobs group by state order by state;
select min(created_at) as oldest_pending
from private.asset_verification_jobs
where state in ('pending', 'retry_wait', 'leased');
```

The cron job and terminal verification rows are pruned after seven days. Logs contain bounded event names, asset UUID, and attempt number only—never object paths, filenames, hashes, URLs, tokens, or audio.

If the Edge path is unavailable, disable `asset-verification-recovery` in Cron and temporarily use the lease-aware operator fallback:

```powershell
npm run assets:verify -- <asset-uuid>
```

The fallback uses the same v2 signature/metadata policy and cannot race an active lease. Do not make it normal browser authority.

## Free-tier guardrails

- Common path: one Edge invocation and one Storage download per uploaded asset.
- Maximum automatic full downloads: two; further work requires an explicit owner retry.
- Status uses bounded no-store polling and no Realtime subscription.
- Empty recovery scans use an indexed database check and do not invoke Edge.
- Measure hosted Edge CPU, memory, latency, invocation count, and unified egress with one small WAV/FLAC/MP3 plus one near-limit file. If the near-limit file breaches the Edge CPU/memory limit after one focused optimization, stop and select a CPU-capable external processor rather than adding retries.
