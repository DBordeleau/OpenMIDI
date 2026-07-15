# Moderation and retention operations

PR 18 is manual-first. Launch correctness does not depend on Cron, Edge Runtime, or a hosted schedule.

## Authority boundaries

- Report submission never changes visibility. Only database-verified administrators can read report detail or apply actions and holds.
- Application administrator RPCs require an active completed profile plus `private.app_admins` membership. UI visibility is not authority.
- Retention RPCs are granted only to `service_role`. Never expose that credential to browser code.
- `storage.objects` is metadata-only and read-only. Delete bytes through the Supabase Storage API; never delete Storage metadata with SQL.

## Daily review

1. Open `/admin/moderation` and assign one report at a time.
2. Review only the bounded target context. Do not copy report detail or hold reasons into logs.
3. Use an explicit reason for dismiss, hide/restore, suspension/restoration, or a legal/abuse hold.
4. Hidden content remains immutable history but loses public discovery, signed audio, and mutation authority.
5. Use `/admin/operations` for object totals, drift, due cleanup, and the latest run.

## Retention preview and execution

From the repository root with local Supabase running:

```powershell
npm run retention:preview
npm run retention:execute -- --limit=10
```

Preview is read-only and groups counts/bytes without object paths. Execution re-previews, creates a bounded run, leases one job at a time, deletes exact objects through the Storage API, and finalizes only after success or already-missing confirmation. A reference or hold added after claim produces `blocked_after_claim`. Repeating the command is safe.

For a remote project, provide the URL and service-role credential only in the operator process environment. Execution additionally requires `--confirm-host=<exact-host>`. Run preview first and compare object totals with the Supabase Dashboard. Never store the key, output, object paths, signed URLs, or report detail in a ticket or commit.

## Drift and failures

- Unknown-size metadata or unexplained untracked objects are a stop condition near the 850 MiB admission ceiling.
- Dead and blocked jobs remain visible in the latest run summary. Fix the reference, hold, or Storage condition; do not edit job state manually.
- If Storage deletion succeeds and finalization crashes, retry: missing-object confirmation is idempotent and quota decrements once.
- If capacity or provider billing disagrees with object metadata, pause new admission with the existing reversible capability only under separate authorization. Disabling admission is never deletion authority.

## Optional scheduling

A future daily schedule may invoke the same bounded operator using Supabase Cron/`pg_net` and Vault-managed secrets after hosted plan, duration, monitoring, and ownership are approved. It must not introduce a second cleanup implementation. No production schedule, URL, token, or Vault secret is committed by PR 18.

## Recovery and legal limitations

Project, eligible contribution, and account deletion is recoverable for 30 days when moderation and holds permit. Published credits, accepted contributions, and fork lineage survive as tombstones. Global sign-out revokes refresh tokens on a best-effort caller-scoped request; issued access tokens and signed URLs expire on their existing short lifetimes, so deleted-profile authorization checks remain mandatory.

Formal takedown, appeal, statutory erasure, emergency response, and production administrator assignment remain reviewed manual release operations.
