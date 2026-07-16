# PR 18 moderation, retention, and storage operations evidence

## Delivered authority

- Private report/action/hold/deletion/retention tables use RLS defense in depth and revoke direct application-role access.
- Report submission is idempotent, fixed-reason, bounded, rate-limited, duplicate-safe, and has no visibility side effect. Reporter status is deliberately coarse.
- Administrator pages call database-verified commands. Moderation projections hide without rewriting immutable revisions, accepted contribution versions, credits, or fork lineage.
- Project, eligible rejected/withdrawn contribution, and account deletion creates an explicit 30-day intent. Account deletion attempts caller-scoped global sign-out while deleted-profile authorization remains authoritative.
- `private.retention_blockers(asset_id)` centralizes live history, workspace, contribution, avatar/processing, verification, owner-library, and transitive hold blockers.
- One Node operator previews, enqueues, leases, removes exact bytes through the Storage API, and finalizes after success/already-missing confirmation. SQL never deletes `storage.objects` rows.
- Forward repair `20260715234558_repair_moderation_retention_safety.sql` makes claim the atomic delete-authorization boundary, blocks new references/holds/reactivation until reconciliation, preserves the barrier across retries, and adds expired-account source cleanup.
- Upload rejection and hold commands compare exact retry inputs before mutation, so request-ID conflicts cannot create unaudited secondary actions.
- Administrator UI exposes profile suspension/restoration and a bounded list of eligible upload rejections without object paths.
- Administrator capacity totals read actual object metadata by bucket; admission adds unmaterialized reservations and registered-missing objects and treats unknown sizes conservatively at the 750/850 MiB thresholds.

## Local proof

- Clean local migration reset: passed while applying the original PR 18 migration followed by `20260715234558_repair_moderation_retention_safety.sql`.
- Focused pgTAP: the original 50 assertions passed, followed by 25 repair assertions covering command idempotency, deletion authorization barriers, safe finalization, deleted-account lifecycle authority, and expired-account source cleanup.
- Focused moderation schema unit tests: 2 passed.
- Strict TypeScript check: passed after generated database types were refreshed.
- Local retention preview: passed with seven named policy groups and no candidates on the clean fixture.
- Bounded local execution: passed with zero candidates and completed as a no-op.
- Query-plan review: the moderation queue can use an index-only scan on `moderation_reports_queue_idx`; retention claims use `retention_cleanup_claim_idx`; active asset holds use `content_holds_asset_idx`; and expired deletion intents use an index-only scan on `deletion_requests_due_idx`.
- Focused local Chromium moderation journey: passed.
- Full local database check: 32 files and 793 pgTAP assertions passed; schema lint reported no warnings and generated types were current.
- Full non-E2E repository check: formatting, lint, strict TypeScript, 238 unit tests, and the production build passed.

Final database, application, build, and browser results are recorded in the implementation handoff.

The forward repair was added because the original PR 18 migration had already been applied to hosted Supabase before merge review. Hosted environments that already have the original migration must apply only the new repair migration next; clean environments apply both in order.

## Hosted state

No hosted migration, administrator row, report, hold, cleanup, Cron/Vault schedule, capability mutation, application deployment, or Storage deletion was performed. The recorded hosted source-admission capability remains enabled; PR 20 owns hosted parity and any separately authorized transition after PR 19.
