import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const supabaseCli = resolve(root, "node_modules/supabase/dist/supabase.js");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
  if (result.error) throw result.error;
  if (options.expectFailure) return result;
  if (result.status !== 0) {
    throw new Error(
      `${command} exited with code ${result.status}.\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}

function runSupabase(args, options) {
  return run(process.execPath, [supabaseCli, ...args], options);
}

function psql(sql) {
  run(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_openmidi",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: sql },
  );
}

function expectGuard(message) {
  const result = runSupabase(["migration", "up", "--local"], {
    expectFailure: true,
  });
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0 || !output.includes(message)) {
    throw new Error(`Expected migration guard ${message}.\n${output}`);
  }
}

let rehearsalError;
try {
  runSupabase(["db", "reset", "--version", "20260722174831", "--no-seed"]);

  for (const bucket of ["profile-images", "public-avatars"]) {
    psql(`insert into storage.objects(id,bucket_id,name) values
      (gen_random_uuid(),'${bucket}','avatar-03-guard-probe');`);
    expectGuard("avatar_storage_objects_remain");
    psql(`set session_replication_role=replica;
      delete from storage.objects where bucket_id='${bucket}'
        and name='avatar-03-guard-probe';
      set session_replication_role=origin;`);
  }

  psql(`set session_replication_role=replica;
    insert into private.content_holds(
      id,request_id,target_kind,target_asset_id,hold_type,reason,placed_by
    ) values (
      'a3000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000002','asset',
      'a3000000-0000-4000-8000-000000000003','legal','guard probe',
      'a3000000-0000-4000-8000-000000000004'
    );
    set session_replication_role=origin;`);
  expectGuard("active_avatar_asset_hold_remains");
  psql(`delete from private.content_holds
    where id='a3000000-0000-4000-8000-000000000001';`);

  psql(`set session_replication_role=replica;
    insert into private.profile_image_processing_jobs(
      asset_id,owner_id,avatar_version_id,status,lease_token,lease_expires_at
    ) values (
      'a3100000-0000-4000-8000-000000000001',
      'a3100000-0000-4000-8000-000000000002',
      'a3100000-0000-4000-8000-000000000003','leased',
      'a3100000-0000-4000-8000-000000000004',statement_timestamp()+interval '5 minutes'
    );
    set session_replication_role=origin;`);
  expectGuard("live_avatar_worker_lease_remains");
  psql(`delete from private.profile_image_processing_jobs
    where asset_id='a3100000-0000-4000-8000-000000000001';`);

  psql(`set session_replication_role=replica;
    insert into private.profile_avatar_cleanup_jobs(
      avatar_version_id,source_asset_id,profile_id,public_object_path,
      private_object_path,status,lease_token,lease_expires_at
    ) values (
      'a3200000-0000-4000-8000-000000000001',
      'a3200000-0000-4000-8000-000000000002',
      'a3200000-0000-4000-8000-000000000003','guard/avatar.webp',
      'guard/original','leased','a3200000-0000-4000-8000-000000000004',
      statement_timestamp()+interval '5 minutes'
    );
    set session_replication_role=origin;`);
  expectGuard("live_avatar_worker_lease_remains");
  psql(`delete from private.profile_avatar_cleanup_jobs
    where avatar_version_id='a3200000-0000-4000-8000-000000000001';`);

  psql(`insert into private.retention_runs(
      id,policy_version,mode,status,requested_at,completed_at
    ) values
      ('a3300000-0000-4000-8000-000000000001','retention-v2','execute',
       'complete',statement_timestamp()-interval '2 minutes',
       statement_timestamp()-interval '2 minutes'),
      ('a3300000-0000-4000-8000-000000000002','retention-v2','execute',
       'complete',statement_timestamp()-interval '1 minute',
       statement_timestamp()-interval '1 minute');
    insert into private.retention_cleanup_jobs(
      id,run_id,policy_version,rule_code,subject_kind,subject_id,
      status,eligible_at,completed_at
    ) values (
      'a3300000-0000-4000-8000-000000000003',
      'a3300000-0000-4000-8000-000000000002','retention-v2',
      'avatar_superseded','avatar',
      'a3300000-0000-4000-8000-000000000004','complete',
      statement_timestamp()-interval '1 minute',
      statement_timestamp()-interval '1 minute'
    );`);

  runSupabase(["migration", "up", "--local"]);
  psql(`do $$ begin
    if to_regclass('public.assets') is not null
      or to_regclass('public.profile_avatar_versions') is not null
      or to_regclass('private.profile_image_processing_jobs') is not null
      or exists(select 1 from pg_policies where schemaname='storage')
    then raise exception 'avatar_03_postcondition_failed'; end if;
    if not exists(
      select 1 from private.retention_runs
      where id='a3300000-0000-4000-8000-000000000001'
    ) then raise exception 'avatar_03_unrelated_empty_run_removed'; end if;
    if exists(
      select 1 from private.retention_runs
      where id='a3300000-0000-4000-8000-000000000002'
    ) then raise exception 'avatar_03_avatar_only_run_preserved'; end if;
  end $$;`);
  console.log("AVATAR-03 guarded contraction rehearsal passed.");
} catch (error) {
  rehearsalError = error;
} finally {
  try {
    runSupabase(["db", "reset"]);
  } catch (error) {
    rehearsalError ??= error;
  }
}

if (rehearsalError) throw rehearsalError;
