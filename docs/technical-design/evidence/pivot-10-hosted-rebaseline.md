# PIVOT-10 hosted Supabase rebaseline evidence

- Date: 2026-07-17
- Project reference: `xjfynngyqywnllgotvcw`
- Outcome: Existing-project MIDI-only rebaseline complete; Vercel deployment deferred

## Safe operational record

- The operator worktree started from merged PIVOT-09 head `888302a74355d14f71e4f9279685fd347e498b4b` on `codex/pivot-10-hosted-rehearsal`.
- The existing project reference, URL/API key identities, Google provider setup, and local environment binding were retained. No new Supabase project was created.
- Legacy Storage objects were removed through the Storage API, legacy Auth users through the Admin API, and obsolete audio functions, secrets, and schedules through their supported management surfaces.
- One linked reset replayed exactly `20260717000001` through `20260717000004`. No SQL-editor schema drop, migration repair, or preliminary manual migration was used.
- Only `process-profile-image` was deployed. The only buckets are private `profile-images` and public `public-avatars`; no musical object exists.
- The owner invitation, onboarding, database administrator, second beta invitation, Google sign-in route, and invitation gate were verified.

No credential, token, email address, object path, signed URL, OAuth code, or secret value is recorded here.

## Product verification

Automated and operator evidence established:

- exact four-migration history and a fixed `search_path` on every application security-definer function;
- public catalog, revision, arrangement, and attribution reads without exposing private projects;
- owner MIDI project creation, Studio save/publish, deterministic public preview, and public revision history;
- contributor workspace creation, Studio save, immutable submission, owner base/submitted comparison, acceptance, attribution, and appended revision;
- copy-on-write fork creation with a valid source project/revision lineage and active fork workspace;
- avatar private-original upload, browser/worker validation, sanitized derivative publication, and profile installation;
- exactly one retained Edge Function, no audio table/function/extension/secret/schedule, and no non-avatar Storage object;
- invitation-gated Auth, onboarding, administrator invitation UI, and uninvited-signup rejection.

The security advisor reports expected informational no-policy findings for deliberately inaccessible operational tables and generic warnings for intentionally callable, caller-authorizing security-definer RPCs. The performance advisor reports expected fresh-database unused indexes and the intentional member/public read-policy pairs. No blocking advisor finding remains.

## Rehearsal corrections

The hosted rehearsal exposed and corrected missing public revision/attribution read policies, public contribution/fork preflights that incorrectly depended on project membership, Studio contribution-session authorization, immutable comparison remounting, post-submit full-page reload behavior, integrated pattern audition teardown, and avatar CORS/dimension feedback. The corrected baseline files and hosted policies agreed while migration history remained exactly four versions at the PIVOT-10 checkpoint.

## Post-rehearsal reconciliation

After the four-migration PIVOT-10 rehearsal, PR #51 preserved administrator-managed beta invitations through forward migration `20260717142701_reconcile_admin_beta_invite_management.sql`. On 2026-07-17 that migration was applied to and recorded by the same hosted project, producing a five-migration history. References above to “exactly four” describe the PIVOT-10 reset checkpoint; the destructive reset was not rerun.

FEEDBACK-01 subsequently added and applied `20260717195748_beta_feedback_intake_admin_triage.sql` and
`20260717203056_serialize_beta_feedback_commands.sql` to the same retained project. Hosted migration history now
contains seven recorded migrations. Future hosted mutation remains separately authorized work.

## Deployment boundary

Jam Session is not deployed to Vercel. No Vercel project, environment variable, binding, deployment, or production smoke test was created or changed during PIVOT-10. A future deployment task must configure the existing Supabase values in server/browser-appropriate scopes and run the production smoke path before launch.

There is no second-project rollback boundary. The existing project was reset in place, old hosted application/Auth/Storage data was intentionally discarded, and Git history is the schema rollback record.
