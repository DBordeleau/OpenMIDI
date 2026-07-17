# Google authentication and invitations

Jam Session uses Supabase Google OAuth with PKCE and an invite-only Before User Created database hook. Repository code does not contain Google credentials, hosted project references, or real invitation emails.

## Google Cloud

1. Create or select the Google Cloud project and configure its OAuth audience and branding.
2. Request only `openid`, email, and profile scopes.
3. Create a Web application OAuth client. Add the application origin and the Supabase Auth callback URI shown in the Supabase dashboard. For optional local Google testing, use `http://127.0.0.1:54321/auth/v1/callback`.
4. Store the client secret in Supabase (or `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` for local CLI configuration), never in a browser or Vercel variable.

## Hosted Supabase

Apply the database migration before enabling the hook, then:

1. Enable Google with the client ID and secret.
2. Set the production Site URL and add exact application `/auth/callback` URLs. Use preview wildcards only after accepting their broader redirect risk.
3. Enable the Before User Created Postgres hook at `pg-functions://postgres/private/hook_require_signup_invitation`.
4. After the application and migration are deployed, sign in as a bootstrapped administrator and use **Invite a collaborator** on `/dashboard` to activate one exact Google email. This adds allowlist access immediately; it does not send an email. Use reviewed SQL against `private.signup_invitations` only for first-administrator bootstrap or operational recovery. Revoke access by setting `revoked_at = now()` through reviewed SQL; revocation UI is not part of the MVP.
5. Verify an invited Google account creates one Auth/profile row and an uninvited account creates neither.

The application needs only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SITE_URL`. Do not add the Google secret or Supabase service-role key to the application environment.

Insert invitations into the same project named by `NEXT_PUBLIC_SUPABASE_URL`; a local invitation has no effect on hosted Auth. Keep the application origin exact and consistent: `localhost` and `127.0.0.1` are different cookie hosts, so switching between them can lose the PKCE verifier during the callback. Add the chosen application callback to the Supabase redirect allowlist and restart Next.js after changing `SITE_URL`.

The first administrator is necessarily a SQL bootstrap because the dashboard command already requires administrator membership. The target Auth user must exist and have an active, completed profile; insert that user ID into `private.app_admins` with a reviewed transaction. If that first user cannot yet create an account, first add their exact normalized address with reviewed SQL, complete Google sign-in and onboarding, then grant administrator membership. Never store administrator authority in provider metadata, public profiles, or application environment variables.

For bootstrap or recovery only, normalize the address exactly as the hook does:

```sql
insert into private.signup_invitations (email_normalized, note)
values (lower(btrim('<email>')), '<reviewed operator note>')
on conflict (email_normalized) do update
set created_at = statement_timestamp(),
    created_by = null,
    revoked_at = null;
```

After that user has completed onboarding, bootstrap the first administrator in a reviewed transaction:

```sql
begin;

insert into private.app_admins (user_id, created_by)
select u.id, u.id
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = lower('<administrator-email>')
  and p.status = 'active'
  and p.profile_completed_at is not null
on conflict (user_id) do nothing;

commit;
```

Confirm the statement affected the expected single user before continuing. Production administrator membership is operator-owned state and must not be seeded by a migration.

If the code exchange succeeds but onboarding raises `viewer_profile_PT500`, the Auth user exists without its required `public.profiles` row. Confirm `auth.users` has the user, check that the `on_auth_user_created` trigger from the identity migration exists, and backfill only missing profile IDs. This can occur for users created before the trigger was deployed; fixing that user does not replace applying the migration for future users.

## Local and CI auth

Google credentials are intentionally optional. Start the reduced stack with `npm run supabase:start:auth`, reset it, set an ephemeral `TEST_AUTH_PASSWORD`, then run `npm run auth:e2e:setup`. The `/test-auth` route additionally requires `ENABLE_TEST_AUTH=true`, is restricted to an `@example.test` actor, and returns 404 in production.

Real Google smoke testing remains an operator step: verify consent domains, invited and rejected creation, callback cookies across refresh, onboarding routing, returning-user routing, safe cancellation errors, and sign-out.
