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
4. Add an invitation with reviewed SQL: `insert into private.signup_invitations (email_normalized, note) values (lower(btrim('<email>')), '<operator note>');`. Revoke it by setting `revoked_at = now()`.
5. Verify an invited Google account creates one Auth/profile row and an uninvited account creates neither.

The application needs only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SITE_URL`. Do not add the Google secret or Supabase service-role key to the application environment.

## Local and CI auth

Google credentials are intentionally optional. Start the reduced stack with `npm run supabase:start:auth`, reset it, set an ephemeral `TEST_AUTH_PASSWORD`, then run `npm run auth:e2e:setup`. The `/test-auth` route additionally requires `ENABLE_TEST_AUTH=true`, is restricted to an `@example.test` actor, and returns 404 in production.

Real Google smoke testing remains an operator step: verify consent domains, invited and rejected creation, callback cookies across refresh, onboarding routing, returning-user routing, safe cancellation errors, and sign-out.
