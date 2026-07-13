-- Keep local seed data deterministic, non-sensitive, and safe to apply on every reset.
-- Domain seed records begin with the product schema in a later pull request.

begin;

-- Intentionally empty: PR 01 establishes the seed entry point only.

commit;
-- Reserved local/CI actor only. The .test TLD cannot receive real Google sign-ins.
insert into private.signup_invitations (email_normalized, note)
values ('jam-session-e2e@example.test', 'local and CI browser test actor')
on conflict (email_normalized) do nothing;
