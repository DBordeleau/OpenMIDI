-- Identity schema, safe public profile projection, and self-authorized username claim.

create schema private;
revoke all on schema private from public;

create type public.account_status as enum ('active', 'suspended', 'deleted');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  username text,
  username_normalized text,
  display_name text,
  credit_name text,
  bio text,
  status public.account_status not null default 'active',
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active_at timestamptz,
  constraint profiles_username_pair_check check (
    (username is null) = (username_normalized is null)
  ),
  constraint profiles_username_format_check check (
    username is null
    or (username = btrim(username) and username ~ '^[A-Za-z0-9_]{3,30}$')
  ),
  constraint profiles_username_normalized_check check (
    username is null or username_normalized = lower(username)
  ),
  constraint profiles_display_name_check check (
    display_name is null
    or (display_name = btrim(display_name) and char_length(display_name) between 1 and 80)
  ),
  constraint profiles_credit_name_check check (
    credit_name is null
    or (credit_name = btrim(credit_name) and char_length(credit_name) between 1 and 120)
  ),
  constraint profiles_bio_check check (bio is null or char_length(bio) <= 500),
  constraint profiles_completion_check check (
    profile_completed_at is null
    or (username is not null and display_name is not null and credit_name is not null)
  ),
  constraint profiles_completion_time_check check (
    profile_completed_at is null or profile_completed_at >= created_at
  ),
  constraint profiles_updated_time_check check (updated_at >= created_at)
);

create unique index profiles_username_normalized_uq
  on public.profiles (username_normalized)
  where username_normalized is not null;

create table public.reserved_usernames (
  username_normalized text primary key,
  reason text,
  created_at timestamptz not null default now(),
  constraint reserved_usernames_format_check check (
    username_normalized = lower(username_normalized)
    and username_normalized ~ '^[a-z0-9_]{3,30}$'
  )
);

create table private.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete restrict
);

alter table public.profiles enable row level security;
alter table public.reserved_usernames enable row level security;
alter table private.app_admins enable row level security;

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create function private.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.set_profile_updated_at() from public;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_profile_updated_at();

create policy profiles_public_read
on public.profiles
for select
to anon, authenticated
using (status = 'active' and profile_completed_at is not null);

create policy profiles_self_read
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create view public.public_profiles
with (security_invoker = true)
as
select
  id,
  username,
  username_normalized,
  display_name,
  credit_name,
  bio,
  created_at,
  updated_at
from public.profiles;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and exists (
      select 1
      from private.app_admins
      where user_id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Stable error contract for callers: PT401 unauthenticated, PT400 invalid,
-- PT409 unavailable, PT412 already claimed, PT403 inactive, PT500 missing row.
create function public.claim_username(p_username text)
returns table (username text, username_normalized text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_requested text := btrim(p_username);
  v_normalized text;
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise sqlstate 'PT401' using message = 'username_claim_unauthenticated';
  end if;

  if p_username is null
    or v_requested !~ '^[A-Za-z0-9_]{3,30}$'
    or v_requested <> p_username then
    raise sqlstate 'PT400' using message = 'username_invalid';
  end if;

  v_normalized := lower(v_requested);

  select * into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise sqlstate 'PT500' using message = 'profile_missing';
  end if;

  if v_profile.status <> 'active' then
    raise sqlstate 'PT403' using message = 'account_inactive';
  end if;

  if v_profile.username_normalized = v_normalized then
    return query select v_profile.username, v_profile.username_normalized;
    return;
  end if;

  if v_profile.username_normalized is not null then
    raise sqlstate 'PT412' using message = 'username_already_claimed';
  end if;

  if exists (
    select 1 from public.reserved_usernames
    where reserved_usernames.username_normalized = v_normalized
  ) then
    raise sqlstate 'PT409' using message = 'username_unavailable';
  end if;

  begin
    update public.profiles
    set username = v_requested,
        username_normalized = v_normalized
    where id = v_user_id
    returning profiles.username, profiles.username_normalized
      into username, username_normalized;
  exception
    when unique_violation then
      raise sqlstate 'PT409' using message = 'username_unavailable';
  end;

  return next;
end;
$$;

revoke all on function public.claim_username(text) from public;
grant execute on function public.claim_username(text) to authenticated;

revoke all on table public.profiles from anon, authenticated;
grant select (
  id, username, username_normalized, display_name, credit_name, bio, created_at, updated_at
) on public.profiles to anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

revoke all on table public.reserved_usernames from anon, authenticated;
revoke all on table private.app_admins from anon, authenticated;

insert into public.reserved_usernames (username_normalized, reason)
values
  ('admin', 'administrative role confusion'),
  ('administrator', 'administrative role confusion'),
  ('api', 'application route'),
  ('auth', 'application route'),
  ('explore', 'application route'),
  ('help', 'support route'),
  ('jam_session', 'product identity'),
  ('jamsession', 'product identity'),
  ('moderator', 'moderation role confusion'),
  ('null', 'system value confusion'),
  ('projects', 'application route'),
  ('root', 'administrative role confusion'),
  ('settings', 'application route'),
  ('studio', 'application route'),
  ('support', 'support identity confusion'),
  ('system', 'system identity confusion'),
  ('undefined', 'system value confusion'),
  ('www', 'host name confusion');

comment on table public.profiles is
  'Private lifecycle-bearing profile rows. Application roles mutate them only through authorized commands.';
comment on view public.public_profiles is
  'Safe profile projection; underlying profile RLS limits rows by lifecycle and viewer identity.';
comment on function public.claim_username(text) is
  'Claims the authenticated active user''s first username atomically; retries of the same normalized name are idempotent.';
comment on function private.is_admin() is
  'Checks only the authenticated caller''s private administrator membership; grants no policy bypass by itself.';
