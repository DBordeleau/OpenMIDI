import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

const ownerId = "e0000000-0000-4000-8000-000000000001";
const projectId = "e1000000-0000-4000-8000-000000000001";
const revisionId = "e2000000-0000-4000-8000-000000000001";
const trackId = "e4000000-0000-4000-8000-000000000001";
const arrangementId = "e5000000-0000-4000-8000-000000000001";
const patternId = "e6000000-0000-4000-8000-000000000001";
const patternVersionId = "e7000000-0000-4000-8000-000000000001";
const clipId = "e8000000-0000-4000-8000-000000000001";
const noteId = "e9000000-0000-4000-8000-000000000001";

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
    insert into public.midi_patterns(id,owner_id,create_request_id,name,visibility,rights_attestation_version,published_at)
      values('${patternId}','${ownerId}','e6000000-0000-4000-8000-000000000011','Midnight pulse','public','cc-by-4.0-attestation-v1',now()) on conflict (id) do nothing;
    insert into public.midi_pattern_versions(id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,ppq,duration_ticks,note_count,content_sha256,reuse_license_code,reuse_license_version,reuse_license_url)
      values('${patternVersionId}','${patternId}',1,'e7000000-0000-4000-8000-000000000011','${ownerId}','Night Signal',480,960,1,repeat('e',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/') on conflict (id) do nothing;
    insert into public.midi_pattern_notes(midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity)
      values('${patternVersionId}','${noteId}',0,480,60,96) on conflict do nothing;
    insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
      values('${arrangementId}','${projectId}','${ownerId}','e5000000-0000-4000-8000-000000000011',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',jsonb_build_object('manifestVersion',3,'engine','openmidi-midi','engineVersion','openmidi-midi-3_tone-15.1.22_presets-1','projectId','${projectId}','tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'musicalKey','c-minor','ppq',480,'durationTicks',960,'tracks',jsonb_build_array(jsonb_build_object('trackId','${trackId}','sortOrder',0,'name','Warm keys pulse','presetId','warm-keys','presetVersion',1,'gainDb',-6,'pan',0,'muted',false,'soloed',false,'clips',jsonb_build_array(jsonb_build_object('clipId','${clipId}','midiPatternVersionId','${patternVersionId}','startTick',0,'durationTicks',960,'sourceStartTick',0,'loop',false))))),repeat('a',64),120,4,4,'c-minor',480,960) on conflict (id) do nothing;
    insert into public.arrangement_tracks(arrangement_version_id,project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed)
      values('${arrangementId}','${projectId}','${trackId}',0,'Warm keys pulse','warm-keys',1,-6,0,false,false) on conflict do nothing;
    insert into public.arrangement_clips(arrangement_version_id,project_id,track_id,clip_id,midi_pattern_version_id,start_tick,duration_ticks,source_start_tick,loop)
      values('${arrangementId}','${projectId}','${trackId}','${clipId}','${patternVersionId}',0,960,0,false) on conflict do nothing;
    insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
      select '${revisionId}','${projectId}',1,'${ownerId}','e2000000-0000-4000-8000-000000000011','First signal',manifest,3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',manifest_sha256,1000,'${arrangementId}' from public.arrangement_versions where id='${arrangementId}' on conflict (id) do nothing;
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
      "supabase_db_openmidi",
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

  test("filters and opens a public project with an on-demand preview", async ({
    page,
  }) => {
    seedDiscoveryFixture();
    const forbiddenRequests: string[] = [];
    page.on("request", (request) => {
      if (/storage\/v1\/object/i.test(request.url()))
        forbiddenRequests.push(request.url());
    });

    await page.goto("/explore");
    await page.getByLabel("Search projects").fill("midnight signal");
    await page.getByText("Shape the sound", { exact: true }).click();
    await page
      .getByRole("group", { name: "Genres" })
      .getByText("Electronic", { exact: true })
      .click();
    await page.getByLabel("Minimum BPM").fill("120");
    await page.getByLabel("Maximum BPM").fill("130");
    await page
      .getByRole("group", { name: "Musical details" })
      .getByText("Open to contributions", { exact: true })
      .click();
    await page.getByRole("button", { name: "Find projects" }).click();
    await expect(page).toHaveURL(/q=midnight\+signal.*genre=electronic/);
    await expect(
      page.getByRole("link", { name: "Midnight Discovery Signal" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Play Midnight Discovery Signal" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Play Midnight Discovery Signal" })
      .click();
    await expect(page.getByText("Now playing")).toBeVisible();
    await page.reload();
    await page.getByRole("link", { name: "Midnight Discovery Signal" }).click();
    await expect(
      page.getByRole("heading", { name: "Midnight Discovery Signal" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Play Midnight Discovery Signal" }),
    ).toBeVisible();
    await expect(
      page.getByText("Warm keys pulse", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Who you would be crediting" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /immutable revisions?/ }),
    ).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export MIDI + attribution" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/licensed\.zip$/);
    await expect(
      page.getByRole("link", { name: "Fork this revision" }),
    ).toHaveAttribute(
      "href",
      `/projects/${projectId}/fork?revision=${revisionId}`,
    );
    expect(forbiddenRequests).toEqual([]);
  });
});
