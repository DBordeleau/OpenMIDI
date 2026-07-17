-- PIVOT-09 reviewed baseline: extensions, identity, Auth onboarding, and taxonomy.
set check_function_bodies = false;
drop extension if exists pg_net cascade;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

CREATE SCHEMA IF NOT EXISTS "private";

ALTER SCHEMA "private" OWNER TO "postgres";

CREATE SCHEMA IF NOT EXISTS "public";

ALTER SCHEMA "public" OWNER TO "pg_database_owner";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE TYPE "public"."account_status" AS ENUM (
    'active',
    'suspended',
    'deleted'
);

ALTER TYPE "public"."account_status" OWNER TO "postgres";

CREATE TYPE "public"."asset_status" AS ENUM (
    'reserved',
    'uploading',
    'processing',
    'ready',
    'failed',
    'deleted'
);

ALTER TYPE "public"."asset_status" OWNER TO "postgres";

CREATE TYPE "public"."contribution_review_decision" AS ENUM (
    'request_changes',
    'reject',
    'accept'
);

ALTER TYPE "public"."contribution_review_decision" OWNER TO "postgres";

CREATE TYPE "public"."contribution_review_reason" AS ENUM (
    'owner_feedback',
    'base_outdated'
);

ALTER TYPE "public"."contribution_review_reason" OWNER TO "postgres";

CREATE TYPE "public"."contribution_status" AS ENUM (
    'draft',
    'submitted',
    'changes_requested',
    'accepted',
    'rejected',
    'withdrawn'
);

ALTER TYPE "public"."contribution_status" OWNER TO "postgres";

CREATE TYPE "public"."member_role" AS ENUM (
    'owner',
    'editor',
    'viewer'
);

ALTER TYPE "public"."member_role" OWNER TO "postgres";

CREATE TYPE "public"."profile_avatar_status" AS ENUM (
    'processing',
    'current',
    'superseded',
    'removed',
    'failed',
    'cleaned'
);

ALTER TYPE "public"."profile_avatar_status" OWNER TO "postgres";

CREATE TYPE "public"."project_status" AS ENUM (
    'draft',
    'active',
    'archived',
    'deleted'
);

ALTER TYPE "public"."project_status" OWNER TO "postgres";

CREATE TYPE "public"."project_visibility" AS ENUM (
    'private',
    'unlisted',
    'public'
);

ALTER TYPE "public"."project_visibility" OWNER TO "postgres";

CREATE TYPE "public"."revision_attribution_kind" AS ENUM (
    'publisher',
    'accepted_contributor'
);

ALTER TYPE "public"."revision_attribution_kind" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."assert_admin_actor"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); begin
  if v_actor is null then raise sqlstate 'PT401' using message='admin_unauthenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.status='active' and p.profile_completed_at is not null)
    or not (select private.is_admin()) then
    raise sqlstate 'PT404' using message='admin_not_found';
  end if;
  return v_actor;
end $$;

ALTER FUNCTION "private"."assert_admin_actor"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

ALTER FUNCTION "private"."handle_new_auth_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."hook_require_signup_invitation"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."hook_require_signup_invitation"("event" "jsonb") OWNER TO "postgres";

COMMENT ON FUNCTION "private"."hook_require_signup_invitation"("event" "jsonb") IS 'Allows Auth user creation only for a normalized active invitation; existing sessions are unaffected.';

CREATE OR REPLACE FUNCTION "private"."is_active_project_actor"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='active' and p.profile_completed_at is not null)
$$;

ALTER FUNCTION "private"."is_active_project_actor"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."is_admin"() OWNER TO "postgres";

COMMENT ON FUNCTION "private"."is_admin"() IS 'Checks only the authenticated caller''s private administrator membership; grants no policy bypass by itself.';

CREATE OR REPLACE FUNCTION "private"."prevent_admin_deleted_account_restore"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if old.status='deleted'
    and new.status is distinct from old.status
    and auth.uid() is distinct from old.id
  then
    raise sqlstate 'PT409' using message='account_deletion_user_controlled';
  end if;
  return new;
end $$;

ALTER FUNCTION "private"."prevent_admin_deleted_account_restore"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."prevent_hidden_content_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ begin
  if old.moderation_state='hidden' and new.moderation_state='hidden'
    and (select auth.uid()) is not null and not private.is_admin()
    then raise sqlstate 'PT403' using message='moderated_content_unavailable'; end if;
  return new;
end $$;

ALTER FUNCTION "private"."prevent_hidden_content_mutation"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."protect_asset_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if old.owner_id<>new.owner_id or old.bucket<>new.bucket or old.object_path<>new.object_path
    or (old.status='ready' and not (
      new.status='deleted' or (new.status='ready' and to_jsonb(new) is not distinct from to_jsonb(old))
    )) then
    raise exception 'immutable_asset';
  end if;
  return new;
end $$;

ALTER FUNCTION "private"."protect_asset_immutability"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."protect_project_fork_lineage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.source_project_id is distinct from old.source_project_id
    or new.source_revision_id is distinct from old.source_revision_id then
    raise sqlstate '55000' using message = 'immutable_project_fork_lineage';
  end if;
  return new;
end
$$;

ALTER FUNCTION "private"."protect_project_fork_lineage"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."reject_append_only_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ begin
  raise sqlstate 'PT403' using message='append_only_record';
end $$;

ALTER FUNCTION "private"."reject_append_only_change"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."reject_immutable_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ begin raise exception using errcode='55000',message='immutable_revision_history'; end $$;

ALTER FUNCTION "private"."reject_immutable_change"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."set_profile_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

ALTER FUNCTION "private"."set_profile_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."assert_viewer_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select private.assert_admin_actor() is not null
$$;

ALTER FUNCTION "public"."assert_viewer_admin"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."claim_username"("p_username" "text") RETURNS TABLE("username" "text", "username_normalized" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;

ALTER FUNCTION "public"."claim_username"("p_username" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."claim_username"("p_username" "text") IS 'Claims the authenticated active user''s first username atomically; retries of the same normalized name are idempotent.';

CREATE OR REPLACE FUNCTION "public"."get_viewer_profile"() RETURNS TABLE("id" "uuid", "username" "text", "username_normalized" "text", "display_name" "text", "credit_name" "text", "bio" "text", "status" "public"."account_status", "profile_completed_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "last_active_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."get_viewer_profile"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_viewer_profile"() IS 'Returns lifecycle-bearing profile data for the authenticated caller only.';

CREATE OR REPLACE FUNCTION "public"."save_own_profile"("p_username" "text", "p_display_name" "text", "p_credit_name" "text", "p_bio" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "username" "text", "username_normalized" "text", "display_name" "text", "credit_name" "text", "bio" "text", "profile_completed_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;

ALTER FUNCTION "public"."save_own_profile"("p_username" "text", "p_display_name" "text", "p_credit_name" "text", "p_bio" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."save_own_profile"("p_username" "text", "p_display_name" "text", "p_credit_name" "text", "p_bio" "text") IS 'Atomically claims the caller username and completes or edits safe public profile fields.';

CREATE OR REPLACE FUNCTION "public"."touch_viewer_activity"() RETURNS TABLE("last_active_at" timestamp with time zone, "touched" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid := (select auth.uid()); v_touched boolean := false;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='activity_unauthenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null) then
    raise sqlstate 'PT403' using message='activity_forbidden';
  end if;
  update public.profiles set last_active_at=statement_timestamp()
  where id=v_actor and (profiles.last_active_at is null or profiles.last_active_at < statement_timestamp() - interval '15 minutes');
  v_touched := found;
  return query select p.last_active_at, v_touched from public.profiles p where p.id=v_actor;
end $$;

ALTER FUNCTION "public"."touch_viewer_activity"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."touch_viewer_activity"() IS 'Throttles operational last_active_at writes to once per fifteen minutes.';

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "private"."app_admins" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);

ALTER TABLE "private"."app_admins" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."signup_invitations" (
    "email_normalized" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "note" "text",
    "revoked_at" timestamp with time zone,
    CONSTRAINT "signup_invitations_email_check" CHECK ((("email_normalized" = "lower"("btrim"("email_normalized"))) AND ("email_normalized" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'::"text") AND ("char_length"("email_normalized") <= 254))),
    CONSTRAINT "signup_invitations_note_check" CHECK ((("note" IS NULL) OR ("char_length"("note") <= 200)))
);

ALTER TABLE "private"."signup_invitations" OWNER TO "postgres";

COMMENT ON TABLE "private"."signup_invitations" IS 'Operational email allowlist used only by the Before User Created Auth hook.';

CREATE TABLE IF NOT EXISTS "public"."genres" (
    "id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "genres_name_check" CHECK ((("name" = "btrim"("name")) AND (("char_length"("name") >= 1) AND ("char_length"("name") <= 80)))),
    CONSTRAINT "genres_slug_check" CHECK ((("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text") AND ("char_length"("slug") <= 50))),
    CONSTRAINT "genres_sort_order_check" CHECK (("sort_order" >= 0))
);

ALTER TABLE "public"."genres" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."instruments" (
    "id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "parent_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "instruments_name_check" CHECK ((("name" = "btrim"("name")) AND (("char_length"("name") >= 1) AND ("char_length"("name") <= 80)))),
    CONSTRAINT "instruments_not_self_parent" CHECK ((("parent_id" IS NULL) OR ("parent_id" <> "id"))),
    CONSTRAINT "instruments_slug_check" CHECK ((("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text") AND ("char_length"("slug") <= 50))),
    CONSTRAINT "instruments_sort_order_check" CHECK (("sort_order" >= 0))
);

ALTER TABLE "public"."instruments" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."licenses" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "allows_derivatives" boolean NOT NULL,
    "requires_attribution" boolean NOT NULL,
    "share_alike" boolean NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "licenses_code_check" CHECK ((("code" ~ '^[a-z0-9]+(?:[.-][a-z0-9]+)*$'::"text") AND ("char_length"("code") <= 40))),
    CONSTRAINT "licenses_flags_check" CHECK (((NOT "share_alike") OR "allows_derivatives")),
    CONSTRAINT "licenses_name_check" CHECK ((("name" = "btrim"("name")) AND (("char_length"("name") >= 1) AND ("char_length"("name") <= 100)))),
    CONSTRAINT "licenses_order_check" CHECK (("sort_order" >= 0)),
    CONSTRAINT "licenses_summary_check" CHECK ((("summary" = "btrim"("summary")) AND (("char_length"("summary") >= 1) AND ("char_length"("summary") <= 300)))),
    CONSTRAINT "licenses_url_check" CHECK ((("url" ~ '^https://[^[:space:]]+$'::"text") AND ("char_length"("url") <= 500)))
);

ALTER TABLE "public"."licenses" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "username_normalized" "text",
    "display_name" "text",
    "credit_name" "text",
    "bio" "text",
    "status" "public"."account_status" DEFAULT 'active'::"public"."account_status" NOT NULL,
    "profile_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_active_at" timestamp with time zone,
    "avatar_version_id" "uuid",
    "avatar_path" "text",
    "avatar_updated_at" timestamp with time zone,
    "moderation_state" "text" DEFAULT 'visible'::"text" NOT NULL,
    "moderation_version" integer DEFAULT 1 NOT NULL,
    "moderation_updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "deletion_requested_at" timestamp with time zone,
    "deletion_restore_until" timestamp with time zone,
    "purged_at" timestamp with time zone,
    CONSTRAINT "profiles_avatar_pair_check" CHECK ((("avatar_version_id" IS NULL) = ("avatar_path" IS NULL))),
    CONSTRAINT "profiles_avatar_path_check" CHECK ((("avatar_path" IS NULL) OR ("avatar_path" ~ (('^'::"text" || ("id")::"text") || '/[0-9a-f-]{36}/avatar[.]webp$'::"text")))),
    CONSTRAINT "profiles_bio_check" CHECK ((("bio" IS NULL) OR ("char_length"("bio") <= 500))),
    CONSTRAINT "profiles_completion_check" CHECK ((("profile_completed_at" IS NULL) OR (("username" IS NOT NULL) AND ("display_name" IS NOT NULL) AND ("credit_name" IS NOT NULL)))),
    CONSTRAINT "profiles_completion_time_check" CHECK ((("profile_completed_at" IS NULL) OR ("profile_completed_at" >= "created_at"))),
    CONSTRAINT "profiles_credit_name_check" CHECK ((("credit_name" IS NULL) OR (("credit_name" = "btrim"("credit_name")) AND (("char_length"("credit_name") >= 1) AND ("char_length"("credit_name") <= 120))))),
    CONSTRAINT "profiles_display_name_check" CHECK ((("display_name" IS NULL) OR (("display_name" = "btrim"("display_name")) AND (("char_length"("display_name") >= 1) AND ("char_length"("display_name") <= 80))))),
    CONSTRAINT "profiles_moderation_state_check" CHECK (("moderation_state" = ANY (ARRAY['visible'::"text", 'hidden'::"text"]))),
    CONSTRAINT "profiles_moderation_version_check" CHECK (("moderation_version" > 0)),
    CONSTRAINT "profiles_updated_time_check" CHECK (("updated_at" >= "created_at")),
    CONSTRAINT "profiles_username_format_check" CHECK ((("username" IS NULL) OR (("username" = "btrim"("username")) AND ("username" ~ '^[A-Za-z0-9_]{3,30}$'::"text")))),
    CONSTRAINT "profiles_username_normalized_check" CHECK ((("username" IS NULL) OR ("username_normalized" = "lower"("username")))),
    CONSTRAINT "profiles_username_pair_check" CHECK ((("username" IS NULL) = ("username_normalized" IS NULL)))
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

COMMENT ON TABLE "public"."profiles" IS 'Private lifecycle-bearing profile rows. Application roles mutate them only through authorized commands.';

CREATE TABLE IF NOT EXISTS "public"."reserved_usernames" (
    "username_normalized" "text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reserved_usernames_format_check" CHECK ((("username_normalized" = "lower"("username_normalized")) AND ("username_normalized" ~ '^[a-z0-9_]{3,30}$'::"text")))
);

ALTER TABLE "public"."reserved_usernames" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" smallint NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tags_display_name_check" CHECK ((("display_name" = "btrim"("display_name")) AND (("char_length"("display_name") >= 1) AND ("char_length"("display_name") <= 80)))),
    CONSTRAINT "tags_slug_check" CHECK ((("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text") AND ("char_length"("slug") <= 50))),
    CONSTRAINT "tags_sort_order_check" CHECK (("sort_order" >= 0))
);

ALTER TABLE "public"."tags" OWNER TO "postgres";

ALTER TABLE ONLY "private"."app_admins"
    ADD CONSTRAINT "app_admins_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "private"."signup_invitations"
    ADD CONSTRAINT "signup_invitations_pkey" PRIMARY KEY ("email_normalized");

ALTER TABLE ONLY "public"."genres"
    ADD CONSTRAINT "genres_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."genres"
    ADD CONSTRAINT "genres_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."genres"
    ADD CONSTRAINT "genres_sort_order_key" UNIQUE ("sort_order");

ALTER TABLE ONLY "public"."instruments"
    ADD CONSTRAINT "instruments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."instruments"
    ADD CONSTRAINT "instruments_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."instruments"
    ADD CONSTRAINT "instruments_sort_order_key" UNIQUE ("sort_order");

ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_pkey" PRIMARY KEY ("code");

ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_sort_order_key" UNIQUE ("sort_order");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reserved_usernames"
    ADD CONSTRAINT "reserved_usernames_pkey" PRIMARY KEY ("username_normalized");

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_sort_order_key" UNIQUE ("sort_order");

CREATE INDEX "instruments_parent_id_idx" ON "public"."instruments" USING "btree" ("parent_id") WHERE ("parent_id" IS NOT NULL);

CREATE INDEX "profiles_moderation_idx" ON "public"."profiles" USING "btree" ("moderation_state", "id");

CREATE UNIQUE INDEX "profiles_username_normalized_uq" ON "public"."profiles" USING "btree" ("username_normalized") WHERE ("username_normalized" IS NOT NULL);

CREATE INDEX "tags_created_by_idx" ON "public"."tags" USING "btree" ("created_by") WHERE ("created_by" IS NOT NULL);

CREATE OR REPLACE TRIGGER "profiles_deleted_account_authority" BEFORE UPDATE OF "status" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."prevent_admin_deleted_account_restore"();

CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."set_profile_updated_at"();

ALTER TABLE ONLY "private"."app_admins"
    ADD CONSTRAINT "app_admins_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."app_admins"
    ADD CONSTRAINT "app_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "private"."signup_invitations"
    ADD CONSTRAINT "signup_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."instruments"
    ADD CONSTRAINT "instruments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."instruments"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE "private"."app_admins" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_genres_read" ON "public"."genres" FOR SELECT TO "authenticated", "anon" USING ("is_active");

CREATE POLICY "active_instruments_read" ON "public"."instruments" FOR SELECT TO "authenticated", "anon" USING ("is_active");

CREATE POLICY "active_licenses_read" ON "public"."licenses" FOR SELECT TO "authenticated", "anon" USING ("is_active");

CREATE POLICY "active_tags_read" ON "public"."tags" FOR SELECT TO "authenticated", "anon" USING ("is_active");

ALTER TABLE "public"."genres" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."instruments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."licenses" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_public_read" ON "public"."profiles" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'active'::"public"."account_status") AND ("profile_completed_at" IS NOT NULL) AND ("moderation_state" = 'visible'::"text")));

CREATE POLICY "profiles_self_read" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));

ALTER TABLE "public"."reserved_usernames" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "private" TO "authenticated";

GRANT USAGE ON SCHEMA "private" TO "supabase_auth_admin";

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

REVOKE ALL ON FUNCTION "private"."assert_admin_actor"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."handle_new_auth_user"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."hook_require_signup_invitation"("event" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "private"."hook_require_signup_invitation"("event" "jsonb") TO "supabase_auth_admin";

REVOKE ALL ON FUNCTION "private"."is_active_project_actor"() FROM PUBLIC;

GRANT ALL ON FUNCTION "private"."is_active_project_actor"() TO "authenticated";

REVOKE ALL ON FUNCTION "private"."is_admin"() FROM PUBLIC;

GRANT ALL ON FUNCTION "private"."is_admin"() TO "authenticated";

REVOKE ALL ON FUNCTION "private"."prevent_admin_deleted_account_restore"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."prevent_hidden_content_mutation"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."protect_asset_immutability"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."protect_project_fork_lineage"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."reject_append_only_change"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."reject_immutable_change"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."set_profile_updated_at"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."assert_viewer_admin"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."assert_viewer_admin"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."claim_username"("p_username" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."claim_username"("p_username" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_viewer_profile"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_viewer_profile"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."save_own_profile"("p_username" "text", "p_display_name" "text", "p_credit_name" "text", "p_bio" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_own_profile"("p_username" "text", "p_display_name" "text", "p_credit_name" "text", "p_bio" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."touch_viewer_activity"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."touch_viewer_activity"() TO "authenticated";

GRANT SELECT ON TABLE "private"."signup_invitations" TO "supabase_auth_admin";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."genres" TO "service_role";

GRANT SELECT ON TABLE "public"."genres" TO "anon";

GRANT SELECT ON TABLE "public"."genres" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."instruments" TO "service_role";

GRANT SELECT ON TABLE "public"."instruments" TO "anon";

GRANT SELECT ON TABLE "public"."instruments" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."licenses" TO "service_role";

GRANT SELECT ON TABLE "public"."licenses" TO "anon";

GRANT SELECT ON TABLE "public"."licenses" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";

GRANT SELECT("id") ON TABLE "public"."profiles" TO "anon";

GRANT SELECT("id") ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT("username") ON TABLE "public"."profiles" TO "anon";

GRANT SELECT("username") ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT("username_normalized") ON TABLE "public"."profiles" TO "anon";

GRANT SELECT("username_normalized") ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT("display_name") ON TABLE "public"."profiles" TO "anon";

GRANT SELECT("display_name") ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT("credit_name") ON TABLE "public"."profiles" TO "anon";

GRANT SELECT("credit_name") ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT("bio") ON TABLE "public"."profiles" TO "anon";

GRANT SELECT("bio") ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "anon";

GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO "anon";

GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT("avatar_version_id") ON TABLE "public"."profiles" TO "anon";

GRANT SELECT("avatar_version_id") ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT("avatar_path") ON TABLE "public"."profiles" TO "anon";

GRANT SELECT("avatar_path") ON TABLE "public"."profiles" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reserved_usernames" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tags" TO "service_role";

GRANT SELECT ON TABLE "public"."tags" TO "anon";

GRANT SELECT ON TABLE "public"."tags" TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";
