import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

test.describe("studio startup smoke", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("opens an editable published revision in one navigation", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const projectId = await setupStudioFixture();

    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);

    const sourceResponses: Array<{ status: number; path: string }> = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/storage/v1/object/"))
        sourceResponses.push({ status: response.status(), path: url.pathname });
    });
    await page.goto(`/projects/${projectId}/studio`);
    await expect(page.getByText("Private draft from revision 1")).toBeVisible();
    await expect(page.getByLabel("Fixture stem label")).toBeVisible({
      timeout: 15_000,
    });
    const loadState = await Promise.race([
      page
        .getByText("ready", { exact: true })
        .waitFor({ timeout: 30_000 })
        .then(() => "ready" as const),
      page
        .getByText("failed", { exact: true })
        .waitFor({ timeout: 30_000 })
        .then(() => "failed" as const),
    ]);
    if (loadState === "failed")
      throw new Error(
        `Fixture audio failed to load: ${JSON.stringify(sourceResponses)}`,
      );
    await expect(
      page.getByRole("button", { name: "Play playback" }),
    ).toBeEnabled();

    const trackLabel = page.getByLabel("Fixture stem label");
    await trackLabel.fill("Saved browser stem");
    await trackLabel.press("Tab");
    await expect(
      page.locator('[aria-live="polite"]').filter({ hasText: "Status: Saved" }),
    ).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByLabel("Saved browser stem label")).toHaveValue(
      "Saved browser stem",
      { timeout: 30_000 },
    );
  });
});

async function setupStudioFixture() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.TEST_AUTH_EMAIL;
  if (!url?.startsWith("http://127.0.0.1:") || !serviceRoleKey || !email)
    throw new Error(
      "Studio fixture preflight requires npm run test:e2e:studio against local Supabase.",
    );
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;
  const actor = users.users.find((user) => user.email === email);
  if (!actor)
    throw new Error("Local E2E actor setup did not create the actor.");

  const projectId = randomUUID();
  const revisionId = randomUUID();
  const assetId = randomUUID();
  const trackId = randomUUID();
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
  const sql = `begin;
    update public.profiles set username='StudioE2EActor', username_normalized='studioe2eactor', display_name='Studio E2E actor', credit_name='Studio E2E actor', profile_completed_at=coalesce(profile_completed_at,now()) where id='${actor.id}';
    insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code) values('${projectId}','${actor.id}','${randomUUID()}','Studio startup fixture',120,'cc-by-4.0');
    insert into public.project_members(project_id,user_id,role,created_by) values('${projectId}','${actor.id}','owner','${actor.id}');
    set constraints all immediate; set constraints all deferred;
    insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at) values('${assetId}','${actor.id}','ready','${actor.id}/${assetId}/source','stem-a.wav',${bytes.byteLength},'audio/wav',${bytes.byteLength},'${sha256}',2000,44100,1,'playwright-fixture-v1',now());
    insert into public.asset_credits(asset_id,position,user_id,credit_name,role) values('${assetId}',0,'${actor.id}','Studio E2E actor','creator');
    update public.assets set credits_confirmed_at=ready_at,credits_confirmation_request_id=id,credits_confirmation_sha256=repeat('c',64) where id='${assetId}';
    insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms) values('${revisionId}','${projectId}',1,'${actor.id}','${randomUUID()}','Fixture revision','${manifest}'::jsonb,1,'waveform-playlist','browser-15.3.4_playout-12.5.4_tone-15.1.22',encode(extensions.digest(convert_to('${manifest}'::jsonb::text,'UTF8'),'sha256'),'hex'),2000);
    insert into public.revision_tracks(revision_id,id,asset_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by) values('${revisionId}','${trackId}','${assetId}','Fixture stem',0,0,2000,0,0,false,false,0,'${actor.id}');
    insert into public.project_asset_references(project_id,asset_id,first_revision_id,added_by) values('${projectId}','${assetId}','${revisionId}','${actor.id}');
    insert into public.project_storage_usage(project_id,source_bytes,unique_source_count) values('${projectId}',${bytes.byteLength},1);
    update public.projects set status='active',current_revision_id='${revisionId}',published_at=now(),lock_version=2 where id='${projectId}';
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
    .upload(`${actor.id}/${assetId}/source`, bytes, {
      contentType: "audio/wav",
      upsert: true,
    });
  if (uploadError) throw uploadError;
  return projectId;
}
