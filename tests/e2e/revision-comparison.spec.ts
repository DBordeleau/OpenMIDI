import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

const ownerId = "da000000-0000-4000-8000-000000000001";
const projectId = "da100000-0000-4000-8000-000000000001";
const patternId = "da200000-0000-4000-8000-000000000001";
const pattern1 = "da300000-0000-4000-8000-000000000001";
const pattern3 = "da300000-0000-4000-8000-000000000003";
const arrangement1 = "da400000-0000-4000-8000-000000000001";
const arrangement2 = "da400000-0000-4000-8000-000000000002";
const arrangement3 = "da400000-0000-4000-8000-000000000003";
const revision1 = "da500000-0000-4000-8000-000000000001";
const revision2 = "da500000-0000-4000-8000-000000000002";
const revision3 = "da500000-0000-4000-8000-000000000003";
const trackId = "da600000-0000-4000-8000-000000000001";
const clipId = "da700000-0000-4000-8000-000000000001";
const note1 = "da800000-0000-4000-8000-000000000001";
const note2 = "da800000-0000-4000-8000-000000000002";
const note3 = "da800000-0000-4000-8000-000000000003";
const note4 = "da800000-0000-4000-8000-000000000004";
const note5 = "da800000-0000-4000-8000-000000000005";

function manifest(patternVersionId: string) {
  return `jsonb_build_object(
    'manifestVersion',3,'engine','openmidi-midi','engineVersion','openmidi-midi-3_tone-15.1.22_presets-1',
    'projectId','${projectId}','tempoBpm',120,
    'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'musicalKey','c-major',
    'ppq',480,'durationTicks',1920,
    'tracks',jsonb_build_array(jsonb_build_object(
      'trackId','${trackId}','sortOrder',0,'name','Revision keys','presetId','warm-keys','presetVersion',1,
      'gainDb',-6,'pan',0,'muted',false,'soloed',false,
      'clips',jsonb_build_array(jsonb_build_object(
        'clipId','${clipId}','midiPatternVersionId','${patternVersionId}',
        'startTick',0,'durationTicks',1920,'sourceStartTick',0,'loop',false)))))`;
}

function seedRevisionComparisonFixture() {
  const sql = `
    begin;
    set constraints all deferred;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values('00000000-0000-0000-0000-000000000000','${ownerId}','authenticated','authenticated','revision-diff-e2e@example.test','','{}','{}',now(),now())
      on conflict (id) do nothing;
    update public.profiles set username='RevisionListener',username_normalized='revisionlistener',display_name='Revision Listener',credit_name='Revision Listener',profile_completed_at=now(),status='active' where id='${ownerId}';
    insert into public.projects(id,owner_id,create_request_id,title,description,bpm,musical_key,license_code)
      values('${projectId}','${ownerId}','da100000-0000-4000-8000-000000000011','Three Passes at Midnight','A public revision comparison fixture',120,'c-major','cc-by-4.0')
      on conflict (id) do nothing;
    insert into public.project_members(project_id,user_id,role,created_by)
      values('${projectId}','${ownerId}','owner','${ownerId}') on conflict do nothing;
    insert into public.midi_patterns(id,owner_id,create_request_id,name,visibility,rights_attestation_version,published_at)
      values('${patternId}','${ownerId}','da200000-0000-4000-8000-000000000011','Revision melody','public','cc-by-4.0-attestation-v1',now())
      on conflict (id) do nothing;
    insert into public.midi_pattern_versions(id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,parent_pattern_version_id,ppq,duration_ticks,note_count,content_sha256,reuse_license_code,reuse_license_version,reuse_license_url)
      values('${pattern1}','${patternId}',1,'da300000-0000-4000-8000-000000000011','${ownerId}','Revision Listener',null,480,1920,3,repeat('1',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/'),
            ('${pattern3}','${patternId}',2,'da300000-0000-4000-8000-000000000013','${ownerId}','Revision Listener','${pattern1}',480,1920,4,repeat('3',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/')
      on conflict (id) do nothing;
    insert into public.midi_pattern_notes(midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity)
      values('${pattern1}','${note1}',0,480,64,96),
            ('${pattern1}','${note2}',720,240,67,84),
            ('${pattern1}','${note3}',1440,240,60,72),
            ('${pattern3}','${note1}',240,720,65,110),
            ('${pattern3}','${note3}',1440,240,60,72),
            ('${pattern3}','${note4}',1080,240,72,100),
            ('${pattern3}','${note5}',1320,240,76,92)
      on conflict do nothing;
    insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
      values('${arrangement1}','${projectId}','${ownerId}','da400000-0000-4000-8000-000000000011',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',${manifest(pattern1)},repeat('a',64),120,4,4,'c-major',480,1920),
            ('${arrangement2}','${projectId}','${ownerId}','da400000-0000-4000-8000-000000000012',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',${manifest(pattern1)},repeat('b',64),120,4,4,'c-major',480,1920),
            ('${arrangement3}','${projectId}','${ownerId}','da400000-0000-4000-8000-000000000013',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',${manifest(pattern3)},repeat('c',64),120,4,4,'c-major',480,1920)
      on conflict (id) do nothing;
    insert into public.arrangement_tracks(arrangement_version_id,project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed)
      values('${arrangement1}','${projectId}','${trackId}',0,'Revision keys','warm-keys',1,-6,0,false,false),
            ('${arrangement2}','${projectId}','${trackId}',0,'Revision keys','warm-keys',1,-6,0,false,false),
            ('${arrangement3}','${projectId}','${trackId}',0,'Revision keys','warm-keys',1,-6,0,false,false)
      on conflict do nothing;
    insert into public.arrangement_clips(arrangement_version_id,project_id,track_id,clip_id,midi_pattern_version_id,start_tick,duration_ticks,source_start_tick,loop)
      values('${arrangement1}','${projectId}','${trackId}','${clipId}','${pattern1}',0,1920,0,false),
            ('${arrangement2}','${projectId}','${trackId}','${clipId}','${pattern1}',0,1920,0,false),
            ('${arrangement3}','${projectId}','${trackId}','${clipId}','${pattern3}',0,1920,0,false)
      on conflict do nothing;
    insert into public.project_revisions(id,project_id,revision_number,parent_revision_id,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
      select '${revision1}'::uuid,'${projectId}'::uuid,1,null,'${ownerId}'::uuid,'da500000-0000-4000-8000-000000000011'::uuid,'First pass',manifest,3,engine,engine_version,manifest_sha256,2000,'${arrangement1}'::uuid from public.arrangement_versions where id='${arrangement1}'
      on conflict (id) do nothing;
    insert into public.project_revisions(id,project_id,revision_number,parent_revision_id,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
      select '${revision2}'::uuid,'${projectId}'::uuid,2,'${revision1}'::uuid,'${ownerId}'::uuid,'da500000-0000-4000-8000-000000000012'::uuid,'Middle pass',manifest,3,engine,engine_version,manifest_sha256,2000,'${arrangement2}'::uuid from public.arrangement_versions where id='${arrangement2}'
      on conflict (id) do nothing;
    insert into public.project_revisions(id,project_id,revision_number,parent_revision_id,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
      select '${revision3}'::uuid,'${projectId}'::uuid,3,'${revision2}'::uuid,'${ownerId}'::uuid,'da500000-0000-4000-8000-000000000013'::uuid,'Final pass',manifest,3,engine,engine_version,manifest_sha256,2000,'${arrangement3}'::uuid from public.arrangement_versions where id='${arrangement3}'
      on conflict (id) do nothing;
    insert into public.revision_attributions(revision_id,kind,user_id,credit_name)
      values('${revision1}','publisher','${ownerId}','Revision Listener'),
            ('${revision2}','publisher','${ownerId}','Revision Listener'),
            ('${revision3}','publisher','${ownerId}','Revision Listener')
      on conflict do nothing;
    update public.projects set visibility='public',status='active',current_revision_id='${revision3}',published_at=now() where id='${projectId}';
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

test.describe("anonymous public revision comparison", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the repository-owned local Supabase runner",
  );

  test("compares non-adjacent revisions, swaps semantics, auditions, and returns to history", async ({
    page,
  }) => {
    seedRevisionComparisonFixture();
    await page.goto(`/projects/${projectId}`);
    await expect(
      page.getByRole("heading", { name: /immutable revisions?/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Compare revisions" }).click();

    await page.getByLabel("From revision").selectOption(revision1);
    await expect(page).toHaveURL(
      new RegExp(`from=${revision1}.*to=${revision3}`),
    );
    const noteComparison = page
      .getByRole("heading", { name: /Note comparison/ })
      .locator("..");
    await expect(
      noteComparison.getByRole("button", { name: "+ 2 Added" }),
    ).toBeVisible();
    await expect(
      noteComparison.getByRole("button", { name: "~ 1 Changed" }),
    ).toBeVisible();
    await expect(
      noteComparison.getByRole("button", { name: "− 1 Removed" }),
    ).toBeVisible();
    await expect(
      noteComparison.getByRole("list", { name: "Note comparison legend" }),
    ).toContainText("dashed outline");
    await expect(noteComparison.getByText(/Revision 1: E4/)).toBeVisible();
    await expect(noteComparison.getByText(/Revision 3: F4/)).toBeVisible();
    const changedBefore = noteComparison.locator(
      '[data-note-state="changed"][data-note-side="before"] rect',
    );
    const changedAfter = noteComparison.locator(
      '[data-note-state="changed"][data-note-side="after"] rect',
    );
    await expect(changedBefore).toHaveCount(1);
    await expect(changedAfter).toHaveCount(1);
    expect(await changedBefore.getAttribute("x")).not.toBe(
      await changedAfter.getAttribute("x"),
    );
    expect(await changedBefore.getAttribute("width")).not.toBe(
      await changedAfter.getAttribute("width"),
    );
    expect(await changedBefore.getAttribute("y")).not.toBe(
      await changedAfter.getAttribute("y"),
    );

    await page.getByRole("button", { name: "Swap sides" }).click();
    await expect(page).toHaveURL(
      new RegExp(`from=${revision3}.*to=${revision1}`),
    );
    const swappedNotes = page
      .getByRole("heading", { name: /Note comparison/ })
      .locator("..");
    await expect(
      swappedNotes.getByRole("button", { name: "+ 1 Added" }),
    ).toBeVisible();
    await expect(
      swappedNotes.getByRole("button", { name: "− 2 Removed" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Play Revision 3" }).click();
    await expect(page.getByText(/Now playing Revision 3/)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Play Revision 1" }).click();
    await expect(
      page.getByText(/Now playing Revision 1.*other side is stopped/),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: "Play Revision 3" }),
    ).toHaveAttribute("aria-pressed", "false");

    await page
      .getByRole("link", { name: "Back to project history" })
      .last()
      .click();
    await expect(page).toHaveURL(`/projects/${projectId}#semantic-history`);
    await expect(
      page.getByRole("heading", { name: /immutable revisions?/ }),
    ).toBeVisible();
  });
});
