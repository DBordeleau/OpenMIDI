-- Administrator-managed current-state beta admission. The existing Auth hook
-- remains the only account-creation authority.

create or replace function public.assert_viewer_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.status = 'active'
        and p.profile_completed_at is not null
    )
    and (select private.is_admin()),
    false
  )
$$;

revoke all on function public.assert_viewer_admin() from public, anon;
grant execute on function public.assert_viewer_admin() to authenticated;

comment on function public.assert_viewer_admin() is
  'Display-only administrator probe. Returns false for ineligible viewers and must not authorize mutations.';

create function public.activate_signup_invitation(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin_actor();
  v_email text := lower(btrim(p_email));
  v_invitation private.signup_invitations%rowtype;
  v_status text;
begin
  if v_email is null
    or v_email = ''
    or char_length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise sqlstate 'PT400' using message = 'signup_invitation_email_invalid';
  end if;

  -- Serialize the natural email key so concurrent first activation and
  -- reactivation requests converge without exposing unique-key errors.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_email, 0)
  );

  select *
    into v_invitation
  from private.signup_invitations i
  where i.email_normalized = v_email
  for update;

  if not found then
    insert into private.signup_invitations (
      email_normalized,
      created_at,
      created_by,
      revoked_at
    )
    values (
      v_email,
      statement_timestamp(),
      v_actor,
      null
    );
    v_status := 'activated';
  elsif v_invitation.revoked_at is null then
    v_status := 'already_active';
  else
    update private.signup_invitations
    set created_at = statement_timestamp(),
        created_by = v_actor,
        revoked_at = null
    where email_normalized = v_email;
    v_status := 'reactivated';
  end if;

  return jsonb_build_object('email', v_email, 'status', v_status);
end;
$$;

revoke all on function public.activate_signup_invitation(text) from public, anon;
grant execute on function public.activate_signup_invitation(text) to authenticated;

comment on function public.activate_signup_invitation(text) is
  'Activates one normalized beta signup address after the exception-raising private administrator guard succeeds; sends no email and creates no Auth user.';

comment on function private.assert_admin_actor() is
  'Exception-raising mutation guard for active completed administrators; unlike the display-only public probe, commands must fail closed through this function.';
