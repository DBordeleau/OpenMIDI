# Moderation and metadata-retention operations

The current operator is manual-first. It owns deletion expiry and moderation-detail minimization only; generated avatars create no cleanup candidates. Launch correctness does not depend on Cron, Edge Runtime, a hosted schedule, or object deletion.

## Authority boundaries

- Report submission never changes visibility. Only database-verified administrators can read report detail or apply actions and holds.
- Application administrator RPCs require an active completed profile plus `private.app_admins` membership. UI visibility is not authority.
- Holds may target profiles, projects, or contributions. Asset/avatar holds are retired.
- Retention RPCs are granted only to `service_role`. Never expose that credential to browser code.

## Daily review

1. Open `/admin/moderation` and assign one report at a time.
2. Review only the bounded target context. Do not copy report detail or hold reasons into logs.
3. Use an explicit reason for dismiss, hide/restore, suspension/restoration, or a legal/abuse hold.
4. Hidden content remains immutable history but loses public discovery and mutation authority.
5. Use `/admin/operations` for due deletion/metadata cleanup and the latest bounded run.

## Retention preview and execution

From the repository root with local Supabase running:

```powershell
npm run retention:preview
npm run retention:execute -- --limit=10
```

Preview is read-only and reports only `deletion_expired_30d` and `moderation_metadata_180d` groups. Execution re-previews, creates a bounded run, and claims one job at a time. Claim rechecks active profile/project/contribution holds under row locks and records delete authorization before finalization. Finalization redacts expired deletion state or old moderation detail; it never returns or deletes object paths. Repeating a completed finalization is safe.

For a remote project, provide the URL and service-role credential only in the operator process environment. Execution additionally requires `--confirm-host=<exact-host>`. Run preview first. Never store the key, report detail, hold reasons, tokens, or sensitive identifiers in a ticket or commit.

## Drift and failures

- Dead and blocked jobs remain visible in the latest run summary. Resolve the hold or state conflict; do not edit job state manually.
- An expired authorized lease is reclaimed without dropping its deletion barrier. A dead authorized job is an operator-review condition.
- If deletion or moderation state differs from the candidate snapshot, stop and inspect the authoritative database before retrying.

## Recovery and legal limitations

Project, eligible contribution, and account deletion is recoverable for 30 days when moderation and holds permit. Account deletion clears generated-avatar configuration; recovery restores the account but does not recreate the prior avatar preference. Published credits, accepted contributions, and fork lineage survive as tombstones. Global sign-out revokes refresh tokens on a best-effort caller-scoped request; issued access tokens expire on their existing short lifetimes, so deleted-profile authorization checks remain mandatory.

Formal takedown, appeal, statutory erasure, emergency response, and production administrator assignment remain reviewed manual release operations.

The release-day invitation, library-rights/copyright, feedback, challenge, seed, disable, and incident procedures are consolidated in [Invite-only beta operations](beta-operations.md).
