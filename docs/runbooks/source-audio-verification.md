# Source-audio verification

Uploads go directly from the authenticated browser to the private `source-audio` bucket. TUS completion only moves an asset to `processing`; it is not usable until an operator verifies its bytes.

Set `NEXT_PUBLIC_SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`, then run:

```powershell
npm run assets:verify -- <asset-uuid>
npm run assets:cleanup -- --dry-run
```

The verifier downloads the private object outside Next.js, enforces the reserved size and audio bounds, parses WAV/FLAC/MP3 structure, computes SHA-256, and invokes the service-role-only atomic promotion command. Invalid assets are marked failed and release reserved quota. Cleanup is dry-run by default. Never expose the service-role key to browser or normal request code.
