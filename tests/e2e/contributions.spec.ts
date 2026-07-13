import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const projectId = "d1000000-0000-4000-8000-000000000001";
const revisionId = "d3000000-0000-4000-8000-000000000001";
const assetId = "d2000000-0000-4000-8000-000000000001";
const ownerId = "d0000000-0000-4000-8000-000000000001";
const trackId = "d4000000-0000-4000-8000-000000000001";
const reviewProjectId = "e1000000-0000-4000-8000-000000000001";
const reviewRevisionId = "e3000000-0000-4000-8000-000000000001";
const reviewContributionId = "e5000000-0000-4000-8000-000000000001";
const reviewVersionId = "e7000000-0000-4000-8000-000000000001";
const reviewAuthorId = "e0000000-0000-4000-8000-000000000002";
const reviewAssetId = "e2000000-0000-4000-8000-000000000001";
const reviewTrackId = "e4000000-0000-4000-8000-000000000001";

function localSupabaseEnv() {
  const output =
    process.platform === "win32"
      ? execFileSync(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", "npx supabase status -o env"],
          { encoding: "utf8" },
        )
      : execFileSync("npx", ["supabase", "status", "-o", "env"], {
          encoding: "utf8",
        });
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([^=]+)="(.*)"$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2]]),
  );
}

async function setupContributionFixture() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing contribution fixture outside local Supabase.");
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users, error: usersError } = await admin.auth.admin.listUsers();
  if (usersError) throw usersError;
  const contributor = users.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!contributor || !/^[0-9a-f-]{36}$/.test(contributor.id))
    throw new Error("Run npm run auth:e2e:setup before contribution E2E.");

  const bytes = await readFile(
    path.join(process.cwd(), "public", "fixtures", "audio", "stem-a.wav"),
  );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const manifest = JSON.stringify({
    manifestVersion: 1,
    engine: "waveform-playlist",
    engineVersion: "browser-15.3.4_playout-12.5.4_tone-15.1.22",
    workspaceId: projectId,
    tempoBpm: 120,
    tracks: [
      {
        trackId,
        assetId,
        instrumentId: null,
        name: "Fixture stem",
        positionMs: 0,
        trimStartMs: 0,
        durationMs: 2000,
        gainDb: 0,
        pan: 0,
        muted: false,
        soloed: false,
        sortOrder: 0,
      },
    ],
  }).replaceAll("'", "''");
  const sql = `
    begin;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('00000000-0000-0000-0000-000000000000','${ownerId}','authenticated','authenticated','contribution-e2e-owner@example.test','','{}','{}',now(),now())
    on conflict (id) do nothing;
    update public.profiles set username='ContributionE2EOwner',username_normalized='contributione2eowner',display_name='Contribution owner',credit_name='Contribution owner',profile_completed_at=now() where id='${ownerId}';
    update public.profiles set username=coalesce(username,'ContributionE2EAuthor'),username_normalized=coalesce(username_normalized,'contributione2eauthor'),display_name=coalesce(display_name,'Contribution author'),credit_name=coalesce(credit_name,'Contribution author'),profile_completed_at=coalesce(profile_completed_at,now()) where id='${contributor.id}';
    insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code)
    values('${projectId}','${ownerId}','d1000000-0000-4000-8000-000000000011','Contribution E2E project',120,'cc-by-4.0')
    on conflict (id) do nothing;
    insert into public.project_members(project_id,user_id,role,created_by) values
    ('${projectId}','${ownerId}','owner','${ownerId}'),
    ('${projectId}','${contributor.id}','viewer','${ownerId}')
    on conflict (project_id,user_id) do nothing;
    set constraints all immediate;
    set constraints all deferred;
    insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at)
    values('${assetId}','${ownerId}','ready','${ownerId}/${assetId}/source','stem-a.wav',${bytes.byteLength},'audio/wav',${bytes.byteLength},'${sha256}',2000,44100,1,'playwright-fixture-v1',now())
    on conflict (id) do nothing;
    insert into public.asset_credits(asset_id,position,user_id,credit_name,role)
    values('${assetId}',0,'${ownerId}','Contribution owner','creator')
    on conflict (asset_id,position) do nothing;
    insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms)
    values('${revisionId}','${projectId}',1,'${ownerId}','d3000000-0000-4000-8000-000000000011','Fixture revision','${manifest}'::jsonb,1,'waveform-playlist','browser-15.3.4_playout-12.5.4_tone-15.1.22',encode(extensions.digest(convert_to('${manifest}'::jsonb::text,'UTF8'),'sha256'),'hex'),2000)
    on conflict (id) do nothing;
    insert into public.revision_tracks(revision_id,id,asset_id,instrument_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by)
    values('${revisionId}','${trackId}','${assetId}',null,'Fixture stem',0,0,2000,0,0,false,false,0,'${ownerId}')
    on conflict (revision_id,id) do nothing;
    insert into public.project_asset_references(project_id,asset_id,first_revision_id,added_by)
    values('${projectId}','${assetId}','${revisionId}','${ownerId}')
    on conflict (project_id,asset_id) do nothing;
    insert into public.project_storage_usage(project_id,source_bytes,unique_source_count)
    values('${projectId}',${bytes.byteLength},1)
    on conflict (project_id) do nothing;
    update public.projects set status='active',current_revision_id='${revisionId}',published_at=coalesce(published_at,now()),open_to_contributions=true,lock_version=2,updated_at=now() where id='${projectId}';
    commit;
  `;
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_jam-session",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  );
  const { error: uploadError } = await admin.storage
    .from("source-audio")
    .upload(ownerId + "/" + assetId + "/source", bytes, {
      contentType: "audio/wav",
      upsert: true,
    });
  if (uploadError) throw uploadError;
}

async function setupReviewFixture() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing review fixture outside local Supabase.");
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const owner = users.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!owner) throw new Error("Run npm run auth:e2e:setup before review E2E.");
  const bytes = await readFile(
    path.join(process.cwd(), "public", "fixtures", "audio", "stem-a.wav"),
  );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const manifest = JSON.stringify({
    manifestVersion: 1,
    engine: "waveform-playlist",
    engineVersion: "browser-15.3.4_playout-12.5.4_tone-15.1.22",
    workspaceId: reviewProjectId,
    tempoBpm: 120,
    tracks: [
      {
        trackId: reviewTrackId,
        assetId: reviewAssetId,
        instrumentId: null,
        name: "Contributor take",
        positionMs: 0,
        trimStartMs: 0,
        durationMs: 2000,
        gainDb: 0,
        pan: 0,
        muted: false,
        soloed: false,
        sortOrder: 0,
      },
    ],
  }).replaceAll("'", "''");
  const snapshotId = "e6000000-0000-4000-8000-000000000001";
  const workspaceId = "e6000000-0000-4000-8000-000000000002";
  const sql = `begin;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('00000000-0000-0000-0000-000000000000','${reviewAuthorId}','authenticated','authenticated','review-e2e-author@example.test','','{}','{}',now(),now()) on conflict(id) do nothing;
    update public.profiles set username=coalesce(username,'ReviewE2EOwner'),username_normalized=coalesce(username_normalized,'reviewe2eowner'),display_name=coalesce(display_name,'Review owner'),credit_name=coalesce(credit_name,'Review owner'),profile_completed_at=coalesce(profile_completed_at,now()) where id='${owner.id}';
    update public.profiles set username='ReviewE2EAuthor',username_normalized='reviewe2eauthor',display_name='Review author',credit_name='Review author',profile_completed_at=now() where id='${reviewAuthorId}';
    insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code) values('${reviewProjectId}','${owner.id}','e1000000-0000-4000-8000-000000000011','Owner review E2E',120,'cc-by-4.0');
    insert into public.project_members(project_id,user_id,role,created_by) values('${reviewProjectId}','${owner.id}','owner','${owner.id}'),('${reviewProjectId}','${reviewAuthorId}','viewer','${owner.id}');
    set constraints all immediate; set constraints all deferred;
    insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at) values('${reviewAssetId}','${reviewAuthorId}','ready','${reviewAuthorId}/${reviewAssetId}/source','stem-a.wav',${bytes.byteLength},'audio/wav',${bytes.byteLength},'${sha256}',2000,44100,1,'playwright-fixture-v1',now());
    insert into public.asset_credits(asset_id,position,user_id,credit_name,role) values('${reviewAssetId}',0,'${reviewAuthorId}','Review author','creator');
    insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms) values('${reviewRevisionId}','${reviewProjectId}',1,'${owner.id}','e3000000-0000-4000-8000-000000000011','Base','${manifest}'::jsonb,1,'waveform-playlist','browser-15.3.4_playout-12.5.4_tone-15.1.22',encode(extensions.digest(convert_to('${manifest}'::jsonb::text,'UTF8'),'sha256'),'hex'),2000);
    insert into public.revision_tracks(revision_id,id,asset_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by) values('${reviewRevisionId}','${reviewTrackId}','${reviewAssetId}','Contributor take',0,0,2000,0,0,false,false,0,'${reviewAuthorId}');
    insert into public.project_asset_references(project_id,asset_id,first_revision_id,added_by) values('${reviewProjectId}','${reviewAssetId}','${reviewRevisionId}','${reviewAuthorId}');
    insert into public.project_storage_usage(project_id,source_bytes,unique_source_count) values('${reviewProjectId}',${bytes.byteLength},1);
    update public.projects set status='active',current_revision_id='${reviewRevisionId}',published_at=now(),open_to_contributions=true,lock_version=2 where id='${reviewProjectId}';
    insert into public.contributions(id,project_id,author_id,create_request_id,base_revision_id,title,status) values('${reviewContributionId}','${reviewProjectId}','${reviewAuthorId}','e5000000-0000-4000-8000-000000000011','${reviewRevisionId}','Browser review','draft');
    insert into public.assets(id,owner_id,kind,status,bucket,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,verification_version,ready_at) values('${snapshotId}','${reviewAuthorId}','workspace_snapshot','ready','workspace-snapshots','${reviewAuthorId}/workspaces/${workspaceId}/snapshots/${snapshotId}/manifest-v1.json','manifest.json',100,'application/json',100,encode(extensions.digest(convert_to('${manifest}'::jsonb::text,'UTF8'),'sha256'),'hex'),'test',now());
    insert into public.contribution_versions(id,contribution_id,version_number,submission_request_id,base_revision_id,snapshot_asset_id,workspace_lock_version,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,attestation_version,created_by) values('${reviewVersionId}','${reviewContributionId}',1,'e7000000-0000-4000-8000-000000000011','${reviewRevisionId}','${snapshotId}',2,'${manifest}'::jsonb,1,'waveform-playlist','browser-15.3.4_playout-12.5.4_tone-15.1.22',encode(extensions.digest(convert_to('${manifest}'::jsonb::text,'UTF8'),'sha256'),'hex'),2000,'contributor-attestation-v1','${reviewAuthorId}');
    insert into public.contribution_version_tracks(contribution_version_id,track_id,asset_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by) values('${reviewVersionId}','${reviewTrackId}','${reviewAssetId}','Contributor take',0,0,2000,0,0,false,false,0,'${reviewAuthorId}');
    update public.contributions set status='submitted',current_version_id='${reviewVersionId}',submitted_at=now() where id='${reviewContributionId}';
    insert into public.workspaces(id,project_id,owner_id,create_request_id,contribution_id,status,snapshot_asset_id,base_revision_id,lock_version,manifest,manifest_version,engine,engine_version,manifest_sha256) values('${workspaceId}','${reviewProjectId}','${reviewAuthorId}','e6000000-0000-4000-8000-000000000011','${reviewContributionId}','active','${snapshotId}','${reviewRevisionId}',2,'${manifest}'::jsonb,1,'waveform-playlist','browser-15.3.4_playout-12.5.4_tone-15.1.22',encode(extensions.digest(convert_to('${manifest}'::jsonb::text,'UTF8'),'sha256'),'hex'));
    insert into public.workspace_tracks(workspace_id,track_id,asset_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order) values('${workspaceId}','${reviewTrackId}','${reviewAssetId}','Contributor take',0,0,2000,0,0,false,false,0);
    commit;`;
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_jam-session",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  );
  const { error: uploadError } = await admin.storage
    .from("source-audio")
    .upload(`${reviewAuthorId}/${reviewAssetId}/source`, bytes, {
      contentType: "audio/wav",
      upsert: true,
    });
  if (uploadError) throw uploadError;
}

test.describe("contribution vertical slice", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true" ||
      process.env.ENABLE_CONTRIBUTION_E2E !== "true",
    "requires explicit local contribution E2E fixture authorization",
  );

  test("creates, saves, submits, and withdraws an immutable proposal", async ({
    page,
  }) => {
    await setupContributionFixture();
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await page.goto("/projects/" + projectId);
    await expect(
      page.getByRole("heading", { name: "Contribution E2E project" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Start contribution" }).click();
    await page.getByLabel("Contribution title").fill("Browser proposal");
    await page.getByLabel("Description (optional)").fill("One saved edit.");
    await page
      .getByRole("button", { name: "Create private contribution" })
      .click();
    await page
      .getByRole("link", { name: "Edit contribution in studio" })
      .click();
    await page.getByRole("button", { name: "Open studio" }).click();
    await page.getByLabel("Track label").fill("Contributor arrangement");
    await page.getByLabel("Track label").press("Tab");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("link", { name: "Return to contribution" }).click();
    const primary = page.getByRole("navigation", { name: "Primary" });
    await expect(
      primary.getByRole("link", { name: "Contributions" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      primary.getByRole("link", { name: "My projects" }),
    ).not.toHaveAttribute("aria-current");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Submit immutable version" })
      .click();
    await expect(
      page.getByText("Submitted Â· Based on exact revision"),
    ).toBeVisible();
    await expect(page.getByText("Version 1")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Withdraw contribution" }).click();
    await expect(
      page.getByText("Withdrawn Â· Based on exact revision"),
    ).toBeVisible();
    await expect(page.getByText("Version 1")).toBeVisible();
  });

  test("owner auditions and accepts an immutable submitted version", async ({
    page,
  }) => {
    await setupReviewFixture();
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await page.waitForURL(/\/(onboarding|settings\/profile)$/);
    await page.goto(`/projects/${reviewProjectId}/contributions`);
    await page.getByRole("link", { name: "Browser review" }).click();
    await expect(
      page.getByRole("heading", { name: "Audition and compare" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open studio" }).click();
    await expect(page.getByText("Contributor take")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Accept contribution" }).click();
    await expect(page.getByText("Accepted as revision 2.")).toBeVisible();
    await expect(
      page.getByText("Accepted · Based on exact revision"),
    ).toBeVisible();
  });
});
