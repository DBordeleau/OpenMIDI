# Moderation and avatar-retention operations

The current MIDI-only operator is manual-first and avatar-only. Launch correctness does not depend on Cron, Edge Runtime, or a hosted schedule.

## Authority boundaries

- Report submission never changes visibility. Only database-verified administrators can read report detail or apply actions and holds.
- Application administrator RPCs require an active completed profile plus `private.app_admins` membership. UI visibility is not authority.
- Retention RPCs are granted only to `service_role`. Never expose that credential to browser code.
- `storage.objects` is metadata-only and read-only. Delete bytes through the Supabase Storage API; never delete Storage metadata with SQL.

## Daily review

1. Open `/admin/moderation` and assign one report at a time.
2. Review only the bounded target context. Do not copy report detail or hold reasons into logs.
3. Use an explicit reason for dismiss, hide/restore, suspension/restoration, or a legal/abuse hold.
4. Hidden content remains immutable history but loses public discovery and mutation authority.
5. Use `/admin/operations` for object totals, drift, due cleanup, and the latest run.

## Retention preview and execution

From the repository root with local Supabase running:

```powershell
npm run retention:preview
npm run retention:execute -- --limit=10
```

Preview is read-only and groups counts/bytes without object paths. Execution re-previews, creates a bounded run, and claims one job at a time. Claim performs the final blocker check under row locks and installs a database deletion barrier before returning object paths. Supported reference, hold, asset-reactivation, avatar-restoration, and account-restoration writers reject changes while that barrier is active. The operator then deletes exact objects through the Storage API and finalizes domain state only after success or already-missing confirmation. The barrier remains active across retries, including partial multi-object avatar deletion. Repeating the command is safe.

For a remote project, provide the URL and service-role credential only in the operator process environment. Execution additionally requires `--confirm-host=<exact-host>`. Run preview first and compare object totals with the Supabase Dashboard. Never store the key, output, object paths, signed URLs, or report detail in a ticket or commit.

## Drift and failures

- Unknown-size metadata or unexplained untracked objects are a stop condition near the 850 MiB admission ceiling.
- Dead and blocked jobs remain visible in the latest run summary. Fix the reference, hold, or Storage condition; do not edit job state manually.
- If Storage deletion succeeds and finalization crashes, retry: missing-object confirmation is idempotent and quota decrements once.
- An expired authorized lease is reclaimed without dropping its deletion barrier. A dead authorized job is an operator-review condition; do not clear its barrier manually until Storage and domain state have been reconciled.
- If capacity or provider billing disagrees with object metadata, pause new admission with the existing reversible capability only under separate authorization. Disabling admission is never deletion authority.

## Optional scheduling

No production schedule, URL, token, or Vault secret is part of the current repository. Any future scheduling requires a separate operations decision and must not introduce a second cleanup implementation.

## Recovery and legal limitations

Project, eligible contribution, and account deletion is recoverable for 30 days when moderation and holds permit. Published credits, accepted contributions, and fork lineage survive as tombstones. Global sign-out revokes refresh tokens on a best-effort caller-scoped request; issued access tokens and signed URLs expire on their existing short lifetimes, so deleted-profile authorization checks remain mandatory.

Formal takedown, appeal, statutory erasure, emergency response, and production administrator assignment remain reviewed manual release operations.
