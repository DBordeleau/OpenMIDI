# PR 18 moderation, retention, and storage operations evidence

## Delivered authority

- Private report/action/hold/deletion/retention tables use RLS defense in depth and revoke direct application-role access.
- Report submission is idempotent, fixed-reason, bounded, rate-limited, duplicate-safe, and has no visibility side effect. Reporter status is deliberately coarse.
- Administrator pages call database-verified commands. Moderation projections hide without rewriting immutable revisions, accepted contribution versions, credits, or fork lineage.
- Project, eligible rejected/withdrawn contribution, and account deletion creates an explicit 30-day intent. Account deletion attempts caller-scoped global sign-out while deleted-profile authorization remains authoritative.
- `private.retention_blockers(asset_id)` centralizes live history, workspace, contribution, avatar/processing, verification, owner-library, and transitive hold blockers.
- One Node operator previews, enqueues, leases, removes exact bytes through the Storage API, and finalizes after success/already-missing confirmation. SQL never deletes `storage.objects` rows.
- Administrator capacity totals read actual object metadata by bucket; admission adds unmaterialized reservations and registered-missing objects and treats unknown sizes conservatively at the 750/850 MiB thresholds.

## Local proof

- Clean local migration reset: passed while applying `20260715224001_moderation_retention_operations.sql`.
- Focused pgTAP: 50 assertions passed in `00280_moderation_retention_operations.test.sql`.
- Focused moderation schema unit tests: 2 passed.
- Strict TypeScript check: passed after generated database types were refreshed.
- Local retention preview: passed with six named policy groups and no candidates on the clean fixture.
- Two bounded local execution runs: passed with zero candidates, proving the empty second run is a no-op.
- Query-plan review: the moderation queue can use an index-only scan on `moderation_reports_queue_idx`; retention claims use `retention_cleanup_claim_idx`; active asset holds use `content_holds_asset_idx`; and expired deletion intents use an index-only scan on `deletion_requests_due_idx`.
- Full local database check: 31 files and 768 pgTAP assertions passed; schema lint reported no warnings and generated types were current.

Final database, application, build, and browser results are recorded in the implementation handoff.

## Hosted state

No hosted migration, administrator row, report, hold, cleanup, Cron/Vault schedule, capability mutation, application deployment, or Storage deletion was performed. The recorded hosted source-admission capability remains enabled; PR 20 owns hosted parity and any separately authorized transition after PR 19.
