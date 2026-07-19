# Invite-only beta operations

This runbook is the operator contract for invitations, moderation, copyright reports, feedback, curated challenges, deterministic beta content, rollback/disable actions, and incidents. The invite-only beta is live at `https://open-midi.vercel.app/`; exact provider credentials, actor emails, and secrets remain outside the repository.

## Authority and stop conditions

Prerequisites for any hosted action:

- a named green commit and an approved target host;
- explicit authority for the exact operation;
- an active completed profile with database administrator membership for administrator commands;
- a verified comparison between the retained hosted schema, the linked migration ledger, and the 16 repository migration versions before any RELEASE-03 migration or deployment action;
- a second operator check for target, intended actor, and any destructive or externally visible action; and
- a secure place for process-scoped credentials that is not shell history, a ticket, logs, or source control.

Stop immediately on a target mismatch, an unexpected migration ledger, an actor/token mismatch, an RLS leak, broken invitation enforcement, a secret in output, musical Storage or remote-audio behavior, a seed conflict, or unexplained provider usage. SQL Editor execution made the schema current without proving that all 16 repository versions are recorded. Do not blindly replay schema SQL. Reconcile missing ledger entries only through a separately reviewed, authorized, non-schema RELEASE-03 procedure, and never repeat the destructive RELEASE-01 cleanup.

## Invitations and administrator access

Normal invitation operation uses **Invite a collaborator** on `/dashboard` while signed in as a database-verified administrator:

1. Confirm the normalized address with the invite sponsor.
2. Submit the exact address and a short non-sensitive note.
3. Record only the time, operator, and success state; do not copy the address into a public ticket.
4. Ask the tester to use Google sign-in and complete their public profile.
5. Confirm an uninvited synthetic account remains rejected and creates no Auth/profile row during the release smoke.

The control grants allowlist access immediately but sends no email. Revocation remains reviewed SQL by setting `revoked_at`; first-administrator bootstrap remains the exceptional procedure in [Google authentication and invitations](../setup/google-auth.md). Stop if more than the intended invitation or administrator row changes.

## Moderation queue

Use `/admin/moderation` for general project, contribution, profile, and abuse reports. Assign one item, inspect only its bounded context, and record one explicit dismiss/hide/restore/suspend/hold action. Reporting alone never changes visibility. Holds and hidden immutable history are not deletion authority.

Use `/admin/library-moderation` for public-library originality and authorization reports. Confirm the exact listing/version and evidence before hiding, restoring, resolving, or dismissing. A hidden listing loses public/reuse authority but retains private audit and lineage evidence.

Use the existing `/admin/operations` and [moderation/retention runbook](moderation-retention.md) for avatar-only retention. No musical object, preview, manifest, or MIDI file belongs in Storage.

## Copyright and contact reports

The in-product **Report unoriginal or unauthorized work** flow is a private moderation intake, not a statutory notice process and not proof of infringement. During RELEASE-03, record the approved public copyright/contact channel before inviting testers. Until that channel is approved:

- do not invent an address or legal promise in product copy;
- preserve the private report and exact listing/version identity;
- hide through the audited administrator action when continued display creates a credible rights risk;
- retain external credits separately from platform lineage; and
- escalate formal notices, counter-notices, appeals, or identity verification outside the application to the named operator/legal owner.

Stop if the report requires exposing reporter identity, private evidence, or restricted content outside the approved review group.

## Feedback triage

Use `/admin/feedback` for authenticated beta bug reports and suggestions:

1. Filter the queue and open one item.
2. Classify it accurately; do not copy sensitive free text into logs or GitHub automatically.
3. Mark handled only after recording the disposition in the private queue.
4. Delete only irrelevant/test material through the provided administrator action.
5. Escalate security, privacy, rights, data-loss, or authorization reports to the incident procedure below.

Feedback has no attachments or automatic diagnostics. Ask the reporter for the minimum additional reproduction detail through the approved contact channel.

## Curated challenge operation

Use `/admin/challenges` to create/review immutable challenge versions and to publish, cancel, moderate, feature, and record results. For the RELEASE-02 fixture, verify the exact `four-bar-spark` title, schedule, constraint hash, and host credit from the seed dry run before import.

- Draft revisions append versions; never rewrite a published version.
- Scheduled/open/voting phase is derived from frozen UTC timestamps; no lifecycle Cron job is expected.
- Submission preflight is advisory; the database revalidates the exact revision.
- Vote totals remain private until close; never query or disclose them early.
- Completion/result corrections are append-only and awards reconcile from exact current results.
- Cancel rather than edit when the published schedule or rules are wrong.

Before publishing, have another operator read the human rules beside the machine constraints and confirm the schedule is still useful. Stop on a past/overlapping schedule, unexpected starter lineage, invalid rights, or a challenge slug conflict.

## RELEASE-02 beta seed dry run

The fixture at `src/features/release/release-02-beta-content.json` is the reviewed authority. `supabase/seed.sql` remains local/CI infrastructure and does not import demo product rows.

The importer defaults to no mutation. It uses only the explicitly supplied actor's authenticated application/database commands, verifies that the access token belongs to that actor, verifies active administrator authority, and reports `CREATE`, `REUSE`, or `CONFLICT` for every project, pattern/listing, and challenge. It never accepts a service-role key.

In a clean PowerShell operator process, set values without printing them:

```powershell
$env:OPENMIDI_SEED_SUPABASE_URL='<approved-url>'
$env:OPENMIDI_SEED_PUBLISHABLE_KEY='<approved-publishable-key>'
$env:OPENMIDI_SEED_ACCESS_TOKEN='<short-lived-admin-access-token>'
npm run seed:beta -- --actor-id '<confirmed-administrator-uuid>'
```

Expected dry-run evidence:

- the approved target origin and confirmed curator credit/UUID;
- fixture version 1, three projects, seven patterns, and one challenge;
- four `commercial_reuse` patterns with reviewed CC BY 4.0 hashes;
- three `reference_only` original patterns with reviewed no-reuse hashes;
- Pocket Circuit as the CC BY forkable project with only commercial-reuse pattern dependencies, while Neon Steps and Windowlight Waltz are all-rights-reserved;
- the challenge constraint hash; and
- only `CREATE` or `REUSE`, with zero `CONFLICT` decisions.

The default command performs no writes. Do not paste its actor identity or target into committed evidence. A conflict is a stop condition: inspect the deterministic request ID/slug collision and revise the fixture in a reviewed change; never delete or overwrite the existing row to force the import.

## Authorized import and idempotency proof

RELEASE-02 does not authorize this step. Only during an explicitly authorized hosted operation, after approving the exact dry run, execute:

```powershell
npm run seed:beta:execute -- --actor-id '<confirmed-administrator-uuid>' --confirm RELEASE-02-BETA-v1
npm run seed:beta -- --actor-id '<confirmed-administrator-uuid>'
```

The second command must report `REUSE` for every item. The importer uses stable request IDs and existing conflict-checking RPCs; it resumes exact incomplete imports and rejects mismatched content. It creates no Auth user, administrator membership, invitation, Storage object, secret, scheduled job, or external service.

Clear the three process-scoped variables after the run and close the operator shell. Record only the approved commit, fixture version, decision counts, content hashes, and smoke outcome.

## Rollback and disable procedures

The hosted schema and linked ledger contain all 16 reviewed migration versions. Before any later hosted migration, verify the exact target and compare local/remote history again. Do not reverse the current schema, blindly replay migration SQL, or repeat the destructive RELEASE-01 cleanup.

For a seed or application incident:

1. Stop further invitations and seed/deployment actions.
2. Roll the application back to the last known-good deployment without changing the database contract.
3. Make seeded projects private through their owner controls.
4. Unlist active library editions through `/library/manage`; do not delete referenced pattern history.
5. Cancel the curated challenge through `/admin/challenges` if its immutable schedule/rules are unsafe. Clear or replace a featured selection through the administrator control when applicable.
6. Hide specific reported content through audited moderation when narrower containment is sufficient.
7. Revoke a compromised invitation or administrator membership only through the reviewed identity procedure.

There is intentionally no broad seed-delete command. Permanent seed cleanup requires a separately reviewed actor-scoped command or normal product deletion/retention paths after lineage, entries, results, awards, saved clips, and reports are checked.

## Incident procedure

Classify the incident first: availability, authorization/privacy, rights/moderation, identity/invitations, data integrity, browser MIDI, avatar Storage, or cost/usage.

1. Record time, commit, deployment, target, affected route, and sanitized symptom.
2. Contain with the narrow reversible action above; preserve immutable evidence.
3. For authorization/privacy, invitation bypass, secret exposure, or cross-user reads, stop the beta and revoke affected credentials/sessions through the provider controls.
4. For rights issues, hide the exact listing/project/challenge entry and preserve the private report.
5. For data integrity, stop writes and compare generated types, migration ledger, exact request IDs, hashes, and command audit rows. Use a reviewed forward repair only.
6. For browser playback, preserve MIDI manifests/hashes and capture browser/OS/preset details without recording audio or uploading musical media.
7. Reopen only after the narrow regression, production smoke, and operator sign-off pass.

Never place tokens, cookies, emails, private report text, signed URLs, object paths, full manifests, or provider secrets in incident notes.

## $0 MIDI-only boundary check

Before invitations and after any incident, confirm:

- Postgres holds structured MIDI manifests/normalized rows; musical Storage buckets and objects do not exist;
- browser-local Tone.js uses only the 24 bundled versioned presets;
- there are no samples, soundfonts, remote synthesis assets, rendered previews, musical Edge Functions, or server-rendered synthesis;
- challenge phases require no Cron/lifecycle worker;
- Storage remains avatar-only and retention remains manual-first; and
- the beta seed contains compact JSON only, so it creates no high-egress asset path.
