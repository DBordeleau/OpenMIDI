-- Invite-only Auth creation and canonical own-profile read/write commands.

create table private.signup_invitations (
  email_normalized text primary key,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  note text,
  revoked_at timestamptz,
  constraint signup_invitations_email_check check (
    email_normalized = lower(btrim(email_normalized))
    and email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and char_length(email_normalized) <= 254
  ),
  constraint signup_invitations_note_check check (
    note is null or char_length(note) <= 200
  )
);

revoke all on table private.signup_invitations from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant select on table private.signup_invitations to supabase_auth_admin;

create function private.hook_require_signup_invitation(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(event -> 'user' ->> 'email'));
begin
  if v_email is not null
    and v_email <> ''
    and exists (
      select 1
      from private.signup_invitations
      where email_normalized = v_email
        and revoked_at is null
    ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'An invitation is required to create an account.'
    )
  );
end;
$$;

revoke all on function private.hook_require_signup_invitation(jsonb) from public, anon, authenticated;
grant execute on function private.hook_require_signup_invitation(jsonb) to supabase_auth_admin;

create function public.get_viewer_profile()
returns table (
  id uuid,
  username text,
  username_normalized text,
  display_name text,
  credit_name text,
  bio text,
  status public.account_status,
  profile_completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  last_active_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise sqlstate 'PT401' using message = 'viewer_unauthenticated';
  end if;

  return query
  select p.id, p.username, p.username_normalized, p.display_name,
    p.credit_name, p.bio, p.status, p.profile_completed_at,
    p.created_at, p.updated_at, p.last_active_at
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise sqlstate 'PT500' using message = 'profile_missing';
  end if;
end;
$$;

revoke all on function public.get_viewer_profile() from public, anon;
grant execute on function public.get_viewer_profile() to authenticated;

create function public.save_own_profile(
  p_username text,
  p_display_name text,
  p_credit_name text,
  p_bio text default null
)
returns table (
  id uuid,
  username text,
  username_normalized text,
  display_name text,
  credit_name text,
  bio text,
  profile_completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_username text := btrim(p_username);
  v_normalized text;
  v_display_name text := btrim(p_display_name);
  v_credit_name text := btrim(p_credit_name);
  v_bio text := nullif(btrim(p_bio), '');
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise sqlstate 'PT401' using message = 'profile_save_unauthenticated';
  end if;

  if p_username is null or v_username <> p_username
    or v_username !~ '^[A-Za-z0-9_]{3,30}$' then
    raise sqlstate 'PT400' using message = 'username_invalid';
  end if;
  if p_display_name is null or v_display_name <> p_display_name
    or char_length(v_display_name) not between 1 and 80 then
    raise sqlstate 'PT400' using message = 'display_name_invalid';
  end if;
  if p_credit_name is null or v_credit_name <> p_credit_name
    or char_length(v_credit_name) not between 1 and 120 then
    raise sqlstate 'PT400' using message = 'credit_name_invalid';
  end if;
  if p_bio is not null and char_length(p_bio) > 500 then
    raise sqlstate 'PT400' using message = 'bio_invalid';
  end if;

  v_normalized := lower(v_username);
  select * into v_profile from public.profiles where profiles.id = v_user_id for update;
  if not found then
    raise sqlstate 'PT500' using message = 'profile_missing';
  end if;
  if v_profile.status <> 'active' then
    raise sqlstate 'PT403' using message = 'account_inactive';
  end if;
  if v_profile.username_normalized is not null
    and v_profile.username_normalized <> v_normalized then
    raise sqlstate 'PT412' using message = 'username_already_claimed';
  end if;
  if v_profile.username_normalized is null and exists (
    select 1 from public.reserved_usernames r where r.username_normalized = v_normalized
  ) then
    raise sqlstate 'PT409' using message = 'username_unavailable';
  end if;

  begin
    update public.profiles p
    set username = coalesce(p.username, v_username),
        username_normalized = coalesce(p.username_normalized, v_normalized),
        display_name = v_display_name,
        credit_name = v_credit_name,
        bio = v_bio,
        profile_completed_at = coalesce(p.profile_completed_at, statement_timestamp())
    where p.id = v_user_id
    returning p.id, p.username, p.username_normalized, p.display_name,
      p.credit_name, p.bio, p.profile_completed_at, p.created_at, p.updated_at
    into id, username, username_normalized, display_name, credit_name,
      bio, profile_completed_at, created_at, updated_at;
  exception when unique_violation then
    raise sqlstate 'PT409' using message = 'username_unavailable';
  end;

  return next;
end;
$$;

revoke all on function public.save_own_profile(text, text, text, text) from public, anon;
grant execute on function public.save_own_profile(text, text, text, text) to authenticated;

comment on table private.signup_invitations is
  'Operational email allowlist used only by the Before User Created Auth hook.';
comment on function private.hook_require_signup_invitation(jsonb) is
  'Allows Auth user creation only for a normalized active invitation; existing sessions are unaffected.';
comment on function public.get_viewer_profile() is
  'Returns lifecycle-bearing profile data for the authenticated caller only.';
comment on function public.save_own_profile(text, text, text, text) is
  'Atomically claims the caller username and completes or edits safe public profile fields.';
