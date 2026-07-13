import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

const ownerId = "e0000000-0000-4000-8000-000000000001";
const projectId = "e1000000-0000-4000-8000-000000000001";
const revisionId = "e2000000-0000-4000-8000-000000000001";
const assetId = "e3000000-0000-4000-8000-000000000001";
const trackId = "e4000000-0000-4000-8000-000000000001";

function seedDiscoveryFixture() {
  const sql = `
    begin;
    set constraints all deferred;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values('00000000-0000-0000-0000-000000000000','${ownerId}','authenticated','authenticated','discovery-e2e@example.test','','{}','{}',now(),now())
      on conflict (id) do nothing;
    update public.profiles set username='NightSignal',username_normalized='nightsignal',display_name='Night Signal',credit_name='Night Signal',profile_completed_at=now(),status='active' where id='${ownerId}';
    insert into public.projects(id,owner_id,create_request_id,title,description,bpm,musical_key,license_code)
      values('${projectId}','${ownerId}','e1000000-0000-4000-8000-000000000011','Midnight Discovery Signal','Warm electronic pulse looking for a new melody',124,'c-minor','cc-by-4.0')
      on conflict (id) do nothing;
    insert into public.project_members(project_id,user_id,role,created_by) values('${projectId}','${ownerId}','owner','${ownerId}') on conflict do nothing;
    insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at)
      values('${assetId}','${ownerId}','ready','${ownerId}/${assetId}/source','discovery.wav',2048,'audio/wav',2048,repeat('e',64),2000,48000,2,'e2e',now())
      on conflict (id) do nothing;
    insert into public.asset_credits(asset_id,position,user_id,credit_name,role) values('${assetId}',0,'${ownerId}','Night Signal','creator') on conflict do nothing;
    update public.assets set credits_confirmed_at=now(),credits_confirmation_request_id='e3000000-0000-4000-8000-000000000011',credits_confirmation_sha256=repeat('f',64) where id='${assetId}';
    insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms)
      values('${revisionId}','${projectId}',1,'${ownerId}','e2000000-0000-4000-8000-000000000011','First signal','{"manifestVersion":1}'::jsonb,1,'waveform-playlist','browser-15.3.4_playout-12.5.4_tone-15.1.22',repeat('a',64),2000)
      on conflict (id) do nothing;
    insert into public.revision_tracks(revision_id,id,asset_id,instrument_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by)
      values('${revisionId}','${trackId}','${assetId}','30000000-0000-4000-8000-00000000000a','Analog pulse',0,0,2000,0,0,false,false,0,'${ownerId}') on conflict do nothing;
    insert into public.revision_track_credits(revision_id,track_id,position,user_id,credit_name,role)
      values('${revisionId}','${trackId}',0,'${ownerId}','Night Signal','creator') on conflict do nothing;
    insert into public.revision_attributions(revision_id,kind,user_id,credit_name)
      values('${revisionId}','publisher','${ownerId}','Night Signal') on conflict do nothing;
    insert into public.project_genres(project_id,genre_id,is_primary) values('${projectId}','10000000-0000-4000-8000-000000000001',true) on conflict do nothing;
    insert into public.project_tags(project_id,tag_id) values('${projectId}','20000000-0000-4000-8000-000000000002') on conflict do nothing;
    update public.projects set visibility='public',status='active',current_revision_id='${revisionId}',published_at=now(),open_to_contributions=true where id='${projectId}';
    select private.refresh_public_project('${projectId}');
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
}

test.describe("anonymous public discovery", () => {
  test.skip(
    process.env.ENABLE_DISCOVERY_E2E !== "true",
    "requires explicit local discovery fixture authorization",
  );

  test("filters and opens a safe metadata-only public project", async ({
    page,
  }) => {
    seedDiscoveryFixture();
    const forbiddenRequests: string[] = [];
    page.on("request", (request) => {
      if (
        /audio-sources|downloads\/stems|storage\/v1\/object|waveform-playlist|tone/i.test(
          request.url(),
        )
      )
        forbiddenRequests.push(request.url());
    });

    await page.goto("/explore");
    await page.getByLabel("Search projects").fill("midnight signal");
    await page.getByLabel("Electronic").check();
    await page.getByLabel("Synthesizer").check();
    await page.getByLabel("Minimum BPM").fill("120");
    await page.getByLabel("Maximum BPM").fill("130");
    await page.getByLabel("Open to contributions").check();
    await page.getByRole("button", { name: "Find projects" }).click();
    await expect(page).toHaveURL(
      /q=midnight\+signal.*genre=electronic.*instrument=synthesizer/,
    );
    await expect(
      page.getByRole("link", { name: "Midnight Discovery Signal" }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("link", { name: "Midnight Discovery Signal" }).click();
    await expect(
      page.getByRole("heading", { name: "Midnight Discovery Signal" }),
    ).toBeVisible();
    await expect(
      page.getByText("Audio preview is not available yet", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("Analog pulse", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Project credits" }),
    ).toBeVisible();
    expect(forbiddenRequests).toEqual([]);
  });
});
