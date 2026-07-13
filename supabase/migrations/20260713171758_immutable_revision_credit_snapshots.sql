alter table public.assets
  add column credits_confirmed_at timestamptz,
  add column credits_confirmation_request_id uuid,
  add column credits_confirmation_sha256 text,
  add constraint assets_credit_confirmation_shape check (
    (credits_confirmed_at is null and credits_confirmation_request_id is null and credits_confirmation_sha256 is null)
    or
    (credits_confirmed_at is not null and credits_confirmation_request_id is not null
      and credits_confirmation_sha256 ~ '^[0-9a-f]{64}$')
  );

create unique index assets_owner_credit_confirmation_request_uq
  on public.assets(owner_id, credits_confirmation_request_id)
  where credits_confirmation_request_id is not null;

create or replace function private.protect_asset_immutability()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.owner_id <> new.owner_id or old.kind <> new.kind or old.bucket <> new.bucket
    or old.object_path <> new.object_path
    or (old.status = 'ready' and
      (to_jsonb(new) - array['credits_confirmed_at','credits_confirmation_request_id','credits_confirmation_sha256'])
      is distinct from
      (to_jsonb(old) - array['credits_confirmed_at','credits_confirmation_request_id','credits_confirmation_sha256']))
    or (old.credits_confirmed_at is not null and (
      new.credits_confirmed_at is distinct from old.credits_confirmed_at
      or new.credits_confirmation_request_id is distinct from old.credits_confirmation_request_id
      or new.credits_confirmation_sha256 is distinct from old.credits_confirmation_sha256
    )) then
    raise exception 'immutable_asset';
  end if;
  return new;
end
$$;

create unique index asset_credits_external_role_name_uq
  on public.asset_credits(asset_id, role, lower(credit_name))
  where user_id is null;

create type public.revision_attribution_kind as enum ('publisher', 'accepted_contributor');

alter table public.revision_tracks
  add constraint revision_tracks_revision_track_asset_uq unique(revision_id, id, asset_id);

create table public.revision_track_credits (
  revision_id uuid not null,
  track_id uuid not null,
  asset_id uuid not null,
  position smallint not null check(position between 0 and 11),
  source_credit_position smallint not null check(source_credit_position between 0 and 11),
  user_id uuid references public.profiles(id) on delete restrict,
  credit_name text not null check(
    credit_name = btrim(credit_name) and char_length(credit_name) between 1 and 120
  ),
  role public.asset_credit_role not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key(revision_id, track_id, position),
  foreign key(revision_id, track_id, asset_id)
    references public.revision_tracks(revision_id, id, asset_id) on delete restrict,
  foreign key(asset_id, source_credit_position)
    references public.asset_credits(asset_id, position) on delete restrict
);
create index revision_track_credits_asset_idx on public.revision_track_credits(asset_id);
create index revision_track_credits_user_idx on public.revision_track_credits(user_id)
  where user_id is not null;

create table public.revision_attributions (
  revision_id uuid not null references public.project_revisions(id) on delete restrict,
  kind public.revision_attribution_kind not null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  credit_name text not null check(
    credit_name = btrim(credit_name) and char_length(credit_name) between 1 and 120
  ),
  contribution_id uuid references public.contributions(id) on delete restrict,
  contribution_version_id uuid references public.contribution_versions(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key(revision_id, kind),
  constraint revision_attributions_kind_shape check (
    (kind = 'publisher' and contribution_id is null and contribution_version_id is null)
    or
    (kind = 'accepted_contributor' and contribution_id is not null and contribution_version_id is not null)
  )
);
create index revision_attributions_user_kind_created_idx
  on public.revision_attributions(user_id, kind, created_at desc);
create index revision_attributions_contribution_idx
  on public.revision_attributions(contribution_id)
  where contribution_id is not null;

create trigger revision_track_credits_immutable
  before update or delete on public.revision_track_credits for each row
  execute function private.reject_immutable_change();
create trigger revision_attributions_immutable
  before update or delete on public.revision_attributions for each row
  execute function private.reject_immutable_change();

alter table public.revision_track_credits enable row level security;
alter table public.revision_attributions enable row level security;
revoke all on public.revision_track_credits, public.revision_attributions
  from public, anon, authenticated;
grant select on public.revision_track_credits, public.revision_attributions to authenticated;

create policy member_revision_track_credits_read
on public.revision_track_credits for select to authenticated
using (
  (select private.is_active_project_actor())
  and exists (
    select 1 from public.project_revisions r
    where r.id = revision_track_credits.revision_id
      and (select private.is_project_member(r.project_id))
  )
);

create policy member_revision_attributions_read
on public.revision_attributions for select to authenticated
using (
  (select private.is_active_project_actor())
  and exists (
    select 1 from public.project_revisions r
    where r.id = revision_attributions.revision_id
      and (select private.is_project_member(r.project_id))
  )
);

do $$
begin
  if exists (
    select 1
    from public.assets a
    where a.status = 'ready'
      and a.kind = 'source_audio'
      and (
        not exists (select 1 from public.asset_credits ac where ac.asset_id = a.id)
        or not exists (
          select 1 from public.asset_credits ac
          where ac.asset_id = a.id and ac.role = 'creator'
        )
        or exists (
          select 1
          from (
            select ac.asset_id, min(ac.position) minimum, max(ac.position) maximum, count(*) amount
            from public.asset_credits ac group by ac.asset_id
          ) ordered
          where ordered.asset_id = a.id
            and (ordered.minimum <> 0 or ordered.maximum <> ordered.amount - 1 or ordered.amount > 12)
        )
      )
  ) then
    raise exception 'credit_backfill_invalid_ready_asset';
  end if;
end
$$;

update public.assets a set
  credits_confirmed_at = coalesce(a.ready_at, a.created_at),
  credits_confirmation_request_id = a.id,
  credits_confirmation_sha256 = encode(
    extensions.digest(convert_to((
      select jsonb_agg(jsonb_build_object(
        'userId', ac.user_id, 'creditName', ac.credit_name, 'role', ac.role
      ) order by ac.position)::text
      from public.asset_credits ac where ac.asset_id = a.id
    ), 'UTF8'), 'sha256'), 'hex'
  )
where a.status = 'ready' and a.kind = 'source_audio';

insert into public.revision_track_credits(
  revision_id, track_id, asset_id, position, source_credit_position,
  user_id, credit_name, role, created_at
)
select rt.revision_id, rt.id, rt.asset_id, ac.position, ac.position,
  ac.user_id, ac.credit_name, ac.role, r.created_at
from public.revision_tracks rt
join public.project_revisions r on r.id = rt.revision_id
join public.asset_credits ac on ac.asset_id = rt.asset_id;

insert into public.revision_attributions(
  revision_id, kind, user_id, credit_name, created_at
)
select r.id, 'publisher', r.created_by, p.credit_name, r.created_at
from public.project_revisions r
join public.profiles p on p.id = r.created_by;

insert into public.revision_attributions(
  revision_id, kind, user_id, credit_name,
  contribution_id, contribution_version_id, created_at
)
select r.id, 'accepted_contributor', c.author_id, p.credit_name,
  r.accepted_contribution_id, r.accepted_contribution_version_id, r.created_at
from public.project_revisions r
join public.contributions c on c.id = r.accepted_contribution_id
join public.profiles p on p.id = c.author_id
where r.accepted_contribution_id is not null;

create function private.reject_confirmed_asset_credit_change()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_asset_id uuid := coalesce(new.asset_id, old.asset_id);
begin
  if exists (
    select 1 from public.assets a
    where a.id = v_asset_id and a.credits_confirmed_at is not null
  ) or exists (
    select 1 from public.workspace_tracks wt where wt.asset_id = v_asset_id
    union all select 1 from public.contribution_version_tracks cvt where cvt.asset_id = v_asset_id
    union all select 1 from public.revision_tracks rt where rt.asset_id = v_asset_id
    union all select 1 from public.project_asset_references par where par.asset_id = v_asset_id
  ) then
    raise sqlstate '55000' using message = 'asset_credits_immutable';
  end if;
  return coalesce(new, old);
end
$$;
create trigger asset_credits_confirmed_immutable
  before insert or update or delete on public.asset_credits
  for each row execute function private.reject_confirmed_asset_credit_change();

create function private.require_confirmed_source_credits()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.assets a
    where a.id = new.asset_id and a.kind = 'source_audio' and a.status = 'ready'
      and a.deleted_at is null and a.credits_confirmed_at is not null
      and exists (
        select 1 from public.asset_credits ac
        where ac.asset_id = a.id and ac.role = 'creator'
      )
  ) then
    raise sqlstate 'PT409' using message = 'asset_credits_unconfirmed';
  end if;
  return new;
end
$$;
create trigger workspace_tracks_require_confirmed_credits
  before insert on public.workspace_tracks for each row
  execute function private.require_confirmed_source_credits();
create trigger contribution_version_tracks_require_confirmed_credits
  before insert on public.contribution_version_tracks for each row
  execute function private.require_confirmed_source_credits();
create trigger revision_tracks_require_confirmed_credits
  before insert on public.revision_tracks for each row
  execute function private.require_confirmed_source_credits();

create function private.snapshot_revision_track_credits()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.revision_track_credits(
    revision_id, track_id, asset_id, position, source_credit_position,
    user_id, credit_name, role
  )
  select new.revision_id, new.id, new.asset_id, ac.position, ac.position,
    ac.user_id, ac.credit_name, ac.role
  from public.asset_credits ac
  where ac.asset_id = new.asset_id
  order by ac.position;
  return new;
end
$$;
create trigger revision_tracks_snapshot_credits
  after insert on public.revision_tracks for each row
  execute function private.snapshot_revision_track_credits();

create function private.snapshot_revision_attributions()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_publisher_name text;
  v_contributor_id uuid;
  v_contributor_name text;
begin
  select p.credit_name into v_publisher_name
  from public.profiles p where p.id = new.created_by;
  if v_publisher_name is null then
    raise sqlstate 'PT409' using message = 'revision_publisher_credit_unavailable';
  end if;
  insert into public.revision_attributions(revision_id, kind, user_id, credit_name)
  values(new.id, 'publisher', new.created_by, v_publisher_name);

  if new.accepted_contribution_id is not null then
    select c.author_id, p.credit_name into v_contributor_id, v_contributor_name
    from public.contributions c
    join public.profiles p on p.id = c.author_id
    where c.id = new.accepted_contribution_id
      and c.current_version_id = new.accepted_contribution_version_id;
    if v_contributor_id is null or v_contributor_name is null then
      raise sqlstate 'PT409' using message = 'revision_contributor_credit_unavailable';
    end if;
    insert into public.revision_attributions(
      revision_id, kind, user_id, credit_name, contribution_id, contribution_version_id
    ) values (
      new.id, 'accepted_contributor', v_contributor_id, v_contributor_name,
      new.accepted_contribution_id, new.accepted_contribution_version_id
    );
  end if;
  return new;
end
$$;
create trigger project_revisions_snapshot_attributions
  after insert on public.project_revisions for each row
  execute function private.snapshot_revision_attributions();

create function public.confirm_source_asset_credits(
  p_asset_id uuid,
  p_request_id uuid,
  p_credits jsonb
)
returns table(asset_id uuid, credits_confirmed_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_asset public.assets%rowtype;
  v_credit jsonb;
  v_position integer;
  v_kind text;
  v_role public.asset_credit_role;
  v_name text;
  v_self_name text;
  v_normalized jsonb;
  v_sha text;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'asset_credit_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'asset_credit_actor_ineligible';
  end if;
  if p_asset_id is null or p_request_id is null or jsonb_typeof(p_credits) <> 'array'
    or jsonb_array_length(p_credits) not between 1 and 12 then
    raise sqlstate '22023' using message = 'asset_credit_invalid';
  end if;

  select * into v_asset from public.assets a
  where a.id = p_asset_id and a.owner_id = v_actor for update;
  if not found then
    raise sqlstate 'PT404' using message = 'asset_credit_asset_not_found';
  end if;

  v_normalized := '[]'::jsonb;
  for v_credit, v_position in
    select value, (ordinality - 1)::integer
    from jsonb_array_elements(p_credits) with ordinality
  loop
    if jsonb_typeof(v_credit) <> 'object'
      or exists (select 1 from jsonb_object_keys(v_credit) k where k not in ('kind','role','creditName'))
      or not (v_credit ? 'kind') or not (v_credit ? 'role') then
      raise sqlstate '22023' using message = 'asset_credit_invalid';
    end if;
    v_kind := v_credit->>'kind';
    begin v_role := (v_credit->>'role')::public.asset_credit_role;
    exception when invalid_text_representation then
      raise sqlstate '22023' using message = 'asset_credit_invalid_role';
    end;
    if v_kind = 'self' then
      if v_credit ? 'creditName' then
        raise sqlstate '22023' using message = 'asset_credit_invalid';
      end if;
      select p.credit_name into v_self_name from public.profiles p where p.id = v_actor;
      if v_self_name is null then raise sqlstate 'PT403' using message = 'asset_credit_actor_ineligible'; end if;
      v_normalized := v_normalized || jsonb_build_array(jsonb_build_object(
        'position', v_position, 'userId', v_actor, 'creditName', v_self_name, 'role', v_role
      ));
    elsif v_kind = 'external' then
      v_name := btrim(v_credit->>'creditName');
      if v_name is null or v_name <> v_credit->>'creditName'
        or char_length(v_name) not between 1 and 120 then
        raise sqlstate '22023' using message = 'asset_credit_invalid_name';
      end if;
      v_normalized := v_normalized || jsonb_build_array(jsonb_build_object(
        'position', v_position, 'userId', null, 'creditName', v_name, 'role', v_role
      ));
    else
      raise sqlstate '22023' using message = 'asset_credit_invalid_kind';
    end if;
  end loop;

  if not exists (
    select 1 from jsonb_array_elements(v_normalized) c where c->>'role' = 'creator'
  ) or exists (
    select 1 from jsonb_array_elements(v_normalized) c
    group by coalesce(c->>'userId', lower(c->>'creditName')), c->>'role'
    having count(*) > 1
  ) then
    raise sqlstate '22023' using message = 'asset_credit_duplicate_or_creator_missing';
  end if;
  v_sha := encode(extensions.digest(convert_to(v_normalized::text, 'UTF8'), 'sha256'), 'hex');

  if v_asset.credits_confirmed_at is not null then
    if v_asset.credits_confirmation_request_id = p_request_id
      and v_asset.credits_confirmation_sha256 = v_sha then
      return query select v_asset.id, v_asset.credits_confirmed_at;
      return;
    end if;
    raise sqlstate 'PT409' using message = 'asset_credits_already_confirmed';
  end if;
  if v_asset.kind <> 'source_audio' or v_asset.status <> 'ready' or v_asset.deleted_at is not null then
    raise sqlstate 'PT409' using message = 'asset_credit_asset_unavailable';
  end if;
  if exists (
    select 1 from public.workspace_tracks wt where wt.asset_id = v_asset.id
    union all select 1 from public.contribution_version_tracks cvt where cvt.asset_id = v_asset.id
    union all select 1 from public.revision_tracks rt where rt.asset_id = v_asset.id
    union all select 1 from public.project_asset_references par where par.asset_id = v_asset.id
  ) then
    raise sqlstate 'PT409' using message = 'asset_credits_already_referenced';
  end if;

  delete from public.asset_credits ac where ac.asset_id = v_asset.id;
  insert into public.asset_credits(asset_id, position, user_id, credit_name, role)
  select v_asset.id, (c->>'position')::smallint, (c->>'userId')::uuid,
    c->>'creditName', (c->>'role')::public.asset_credit_role
  from jsonb_array_elements(v_normalized) c;
  update public.assets set
    credits_confirmed_at = statement_timestamp(),
    credits_confirmation_request_id = p_request_id,
    credits_confirmation_sha256 = v_sha
  where id = v_asset.id
  returning assets.id, assets.credits_confirmed_at into asset_id, credits_confirmed_at;
  return next;
exception
  when unique_violation then
    raise sqlstate '22023' using message = 'asset_credit_duplicate';
end
$$;

revoke all on function public.confirm_source_asset_credits(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.confirm_source_asset_credits(uuid, uuid, jsonb)
  to authenticated;
revoke all on function private.reject_confirmed_asset_credit_change(),
  private.require_confirmed_source_credits(), private.snapshot_revision_track_credits(),
  private.snapshot_revision_attributions() from public, anon, authenticated;

comment on column public.assets.credits_confirmed_at is
  'When the owner finalized ordered authorship metadata; null credits remain provisional.';
comment on table public.revision_track_credits is
  'Immutable ordered musical-credit snapshots owned by a published revision track.';
comment on table public.revision_attributions is
  'Immutable publisher and accepted-contributor activity attribution for a revision.';
comment on function public.confirm_source_asset_credits(uuid, uuid, jsonb) is
  'Owner-only idempotent finalization of ordered source-asset credits before first reference.';
