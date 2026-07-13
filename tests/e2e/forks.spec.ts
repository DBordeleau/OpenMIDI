import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const sourceProjectId = "f1000000-0000-4000-8000-000000000001";
const sourceRevisionId = "f3000000-0000-4000-8000-000000000001";
const sourceAssetId = "f2000000-0000-4000-8000-000000000001";
const sourceTrackId = "f4000000-0000-4000-8000-000000000001";

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

function queryLocalDatabase(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_jam-session",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
}

async function setupForkFixture() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing fork fixture outside local Supabase.");

  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users, error: usersError } = await admin.auth.admin.listUsers();
  if (usersError) throw usersError;
  const actor = users.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!actor || !/^[0-9a-f-]{36}$/.test(actor.id))
    throw new Error("Run npm run auth:e2e:setup before fork E2E.");

  const manifest = JSON.stringify({
    manifestVersion: 1,
    engine: "waveform-playlist",
    engineVersion: "browser-15.3.4_playout-12.5.4_tone-15.1.22",
    workspaceId: sourceProjectId,
    tempoBpm: 120,
    tracks: [
      {
        trackId: sourceTrackId,
        assetId: sourceAssetId,
        instrumentId: null,
        name: "Fork fixture stem",
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
    update public.profiles
      set username=coalesce(username,'ForkE2EActor'),
          username_normalized=coalesce(username_normalized,'forke2eactor'),
          display_name=coalesce(display_name,'Fork actor'),
          credit_name=coalesce(credit_name,'Fork actor'),
          profile_completed_at=coalesce(profile_completed_at,now())
      where id='${actor.id}';
    insert into public.projects(id,owner_id,create_request_id,title,description,bpm,license_code)
      values('${sourceProjectId}','${actor.id}','f1000000-0000-4000-8000-000000000011','Fork E2E source','Browser fork source',120,'cc-by-4.0')
      on conflict (id) do nothing;
    insert into public.project_members(project_id,user_id,role,created_by)
      values('${sourceProjectId}','${actor.id}','owner','${actor.id}')
      on conflict (project_id,user_id) do nothing;
    set constraints all immediate;
    set constraints all deferred;
    insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at)
      values('${sourceAssetId}','${actor.id}','ready','${actor.id}/${sourceAssetId}/source','fork-fixture.wav',4096,'audio/wav',4096,repeat('a',64),2000,44100,1,'playwright-fixture-v1',now())
      on conflict (id) do nothing;
    insert into public.asset_credits(asset_id,position,user_id,credit_name,role)
      select '${sourceAssetId}',0,'${actor.id}','Fork actor','creator'
      where not exists (
        select 1 from public.asset_credits
        where asset_id='${sourceAssetId}' and position=0
      );
    update public.assets
      set credits_confirmed_at=ready_at,
          credits_confirmation_request_id=id,
          credits_confirmation_sha256=repeat('c',64)
      where id='${sourceAssetId}' and credits_confirmed_at is null;
    insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms)
      values('${sourceRevisionId}','${sourceProjectId}',1,'${actor.id}','f3000000-0000-4000-8000-000000000011','Fork fixture revision','${manifest}'::jsonb,1,'waveform-playlist','browser-15.3.4_playout-12.5.4_tone-15.1.22',encode(extensions.digest(convert_to('${manifest}'::jsonb::text,'UTF8'),'sha256'),'hex'),2000)
      on conflict (id) do nothing;
    insert into public.revision_tracks(revision_id,id,asset_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by)
      values('${sourceRevisionId}','${sourceTrackId}','${sourceAssetId}','Fork fixture stem',0,0,2000,0,0,false,false,0,'${actor.id}')
      on conflict (revision_id,id) do nothing;
    insert into public.project_asset_references(project_id,asset_id,first_revision_id,added_by)
      values('${sourceProjectId}','${sourceAssetId}','${sourceRevisionId}','${actor.id}')
      on conflict (project_id,asset_id) do nothing;
    insert into public.project_storage_usage(project_id,source_bytes,unique_source_count)
      values('${sourceProjectId}',4096,1)
      on conflict (project_id) do nothing;
    update public.projects
      set status='active', current_revision_id='${sourceRevisionId}',
          published_at=coalesce(published_at,now()), lock_version=2,
          open_to_contributions=false, updated_at=now()
      where id='${sourceProjectId}' and current_revision_id is null;
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

  const assetCount = Number(
    queryLocalDatabase("select count(*) from public.assets"),
  );
  if (!Number.isSafeInteger(assetCount))
    throw new Error("Fork fixture asset count unavailable.");
  return { actorId: actor.id, assetCount };
}

test.describe("copy-on-write project forks", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true" ||
      process.env.ENABLE_FORK_E2E !== "true",
    "requires explicit local fork E2E fixture authorization",
  );

  test("creates a private fork and exposes navigable lineage", async ({
    page,
  }) => {
    const fixture = await setupForkFixture();
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await page.waitForURL(/\/(onboarding|settings\/profile)$/);
    await page.goto(`/projects/${sourceProjectId}`);
    await expect(
      page.getByRole("heading", { name: "Fork E2E source" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Fork this revision" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Create your own version of Fork E2E source",
      }),
    ).toBeVisible();
    await expect(page.getByText("Revision 1", { exact: true })).toBeVisible();
    await page.getByLabel("Project title").fill("Fork E2E result");
    await page.getByLabel("Description").fill("Independent browser fork");
    await page.getByRole("button", { name: "Create private fork" }).click();

    await page.waitForURL(/\/projects\/[0-9a-f-]{36}\?forked=1$/);
    const targetProjectId = new URL(page.url()).pathname.split("/").at(-1);
    expect(targetProjectId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByText("Private fork created.")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Fork E2E result" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Fork lineage" }),
    ).toBeVisible();
    await expect(page.getByText("Forked from", { exact: false })).toContainText(
      "revision 1",
    );

    await page.getByRole("link", { name: "Fork E2E source" }).click();
    await expect(
      page.getByRole("heading", { name: "Direct forks" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Fork E2E result" }).first(),
    ).toBeVisible();

    const target = JSON.parse(
      queryLocalDatabase(`
        select json_build_object(
          'owner_id', owner_id,
          'source_project_id', source_project_id,
          'source_revision_id', source_revision_id,
          'visibility', visibility,
          'open_to_contributions', open_to_contributions,
          'current_revision_id', current_revision_id
        )::text
        from public.projects where id='${targetProjectId}'
      `),
    ) as Record<string, unknown>;
    expect(target).toMatchObject({
      owner_id: fixture.actorId,
      source_project_id: sourceProjectId,
      source_revision_id: sourceRevisionId,
      visibility: "private",
      open_to_contributions: false,
    });
    expect(target.current_revision_id).toMatch(/^[0-9a-f-]{36}$/);

    const assetCount = Number(
      queryLocalDatabase("select count(*) from public.assets"),
    );
    const workspaceCount = Number(
      queryLocalDatabase(
        `select count(*) from public.workspaces where project_id='${targetProjectId}'`,
      ),
    );
    expect(assetCount).toBe(fixture.assetCount);
    expect(workspaceCount).toBe(0);
  });
});
