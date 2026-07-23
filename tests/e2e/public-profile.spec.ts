import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

const publicProfileId = "f0000000-0000-4000-8000-000000000001";
const hiddenProfileId = "f0000000-0000-4000-8000-000000000002";
const sparseProfileId = "f0000000-0000-4000-8000-000000000003";
const projectId = "f1000000-0000-4000-8000-000000000001";
const revisionId = "f2000000-0000-4000-8000-000000000001";
const trackId = "f4000000-0000-4000-8000-000000000001";
const arrangementId = "f5000000-0000-4000-8000-000000000001";
const patternId = "f6000000-0000-4000-8000-000000000001";
const patternVersionId = "f7000000-0000-4000-8000-000000000001";
const clipId = "f8000000-0000-4000-8000-000000000001";
const noteId = "f9000000-0000-4000-8000-000000000001";

function seedPublicProfileFixture() {
  const sql = `
    begin;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values
        ('00000000-0000-0000-0000-000000000000','${publicProfileId}','authenticated','authenticated','profile-canvas@example.test','','{}','{}',now(),now()),
        ('00000000-0000-0000-0000-000000000000','${hiddenProfileId}','authenticated','authenticated','profile-hidden@example.test','','{}','{}',now(),now()),
        ('00000000-0000-0000-0000-000000000000','${sparseProfileId}','authenticated','authenticated','profile-sparse@example.test','','{}','{}',now(),now())
      on conflict (id) do nothing;
    update public.profiles
      set username='ProfileCanvas',
          username_normalized='profilecanvas',
          display_name='Profile Canvas',
          credit_name='Canvas Credits',
          bio=null,
          profile_completed_at=now(),
          status='active',
          moderation_state='visible',
          purged_at=null,
          avatar_config=null
      where id='${publicProfileId}';
    update public.profiles
      set username='HiddenCanvas',
          username_normalized='hiddencanvas',
          display_name='Hidden Canvas',
          credit_name='Hidden Credits',
          profile_completed_at=now(),
          status='active',
          moderation_state='hidden',
          purged_at=null
      where id='${hiddenProfileId}';
    update public.profiles
      set username='SparseCanvas',
          username_normalized='sparsecanvas',
          display_name='Sparse Canvas',
          credit_name='Sparse Credits',
          bio=null,
          profile_completed_at=now(),
          status='active',
          moderation_state='visible',
          purged_at=null,
          avatar_config=null
      where id='${sparseProfileId}';
    insert into public.projects(id,owner_id,create_request_id,title,description,bpm,musical_key,license_code)
      values('${projectId}','${publicProfileId}','f1000000-0000-4000-8000-000000000011','Profile Pulse','A compact public-profile preview fixture.',120,'c-minor','cc-by-4.0')
      on conflict (id) do nothing;
    insert into public.project_members(project_id,user_id,role,created_by)
      values('${projectId}','${publicProfileId}','owner','${publicProfileId}')
      on conflict do nothing;
    insert into public.midi_patterns(id,owner_id,create_request_id,name,visibility,rights_attestation_version,published_at)
      values('${patternId}','${publicProfileId}','f6000000-0000-4000-8000-000000000011','Profile pulse pattern','public','cc-by-4.0-attestation-v1',now())
      on conflict (id) do nothing;
    insert into public.midi_pattern_versions(id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,ppq,duration_ticks,note_count,content_sha256,reuse_license_code,reuse_license_version,reuse_license_url)
      values('${patternVersionId}','${patternId}',1,'f7000000-0000-4000-8000-000000000011','${publicProfileId}','Canvas Credits',480,960,1,repeat('e',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/')
      on conflict (id) do nothing;
    insert into public.midi_pattern_notes(midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity)
      values('${patternVersionId}','${noteId}',0,480,60,96)
      on conflict do nothing;
    insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
      values('${arrangementId}','${projectId}','${publicProfileId}','f5000000-0000-4000-8000-000000000011',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',jsonb_build_object('manifestVersion',3,'engine','openmidi-midi','engineVersion','openmidi-midi-3_tone-15.1.22_presets-1','projectId','${projectId}','tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'musicalKey','c-minor','ppq',480,'durationTicks',960,'tracks',jsonb_build_array(jsonb_build_object('trackId','${trackId}','sortOrder',0,'name','Profile pulse','presetId','warm-keys','presetVersion',1,'gainDb',-6,'pan',0,'muted',false,'soloed',false,'clips',jsonb_build_array(jsonb_build_object('clipId','${clipId}','midiPatternVersionId','${patternVersionId}','startTick',0,'durationTicks',960,'sourceStartTick',0,'loop',false))))),repeat('a',64),120,4,4,'c-minor',480,960)
      on conflict (id) do nothing;
    insert into public.arrangement_tracks(arrangement_version_id,project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed)
      values('${arrangementId}','${projectId}','${trackId}',0,'Profile pulse','warm-keys',1,-6,0,false,false)
      on conflict do nothing;
    insert into public.arrangement_clips(arrangement_version_id,project_id,track_id,clip_id,midi_pattern_version_id,start_tick,duration_ticks,source_start_tick,loop)
      values('${arrangementId}','${projectId}','${trackId}','${clipId}','${patternVersionId}',0,960,0,false)
      on conflict do nothing;
    insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
      select '${revisionId}','${projectId}',1,'${publicProfileId}','f2000000-0000-4000-8000-000000000011','Profile preview',manifest,3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',manifest_sha256,1000,'${arrangementId}'
      from public.arrangement_versions where id='${arrangementId}'
      on conflict (id) do nothing;
    insert into public.revision_attributions(revision_id,kind,user_id,credit_name)
      values('${revisionId}','publisher','${publicProfileId}','Canvas Credits')
      on conflict do nothing;
    insert into public.project_genres(project_id,genre_id,is_primary)
      values('${projectId}','10000000-0000-4000-8000-000000000001',true)
      on conflict do nothing;
    update public.projects
      set visibility='public',
          status='active',
          current_revision_id='${revisionId}',
          published_at=now(),
          open_to_contributions=true
      where id='${projectId}';
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

test.describe("public profile presentation", () => {
  test.skip(
    process.env.ENABLE_PUBLIC_PROFILE_E2E !== "true",
    "requires the deterministic local profile fixture",
  );

  test("keeps previews deliberate, sparse identity useful, private states hidden, and mobile layout bounded", async ({
    page,
  }) => {
    seedPublicProfileFixture();
    const previewRequests: string[] = [];
    const forbiddenEgress: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes(`/api/projects/${projectId}/revisions/`))
        previewRequests.push(url);
      if (
        /dicebear/i.test(url) ||
        url.includes("/storage/v1/") ||
        url.includes("/functions/v1/") ||
        /\.(?:mp3|wav|ogg|m4a)(?:\?|$)/i.test(url)
      )
        forbiddenEgress.push(url);
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/@ProfileCanvas");
    await expect(
      page.getByRole("heading", { level: 1, name: "Profile Canvas" }),
    ).toBeVisible();
    await expect(
      page.getByText("@ProfileCanvas", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Canvas Credits")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Public Projects" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Profile Pulse", exact: true }),
    ).toHaveAttribute("href", `/projects/${projectId}`);
    await expect(
      page.getByRole("button", { name: "Play Profile Pulse" }),
    ).toBeVisible();
    expect(previewRequests).toEqual([]);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Report this profile" }),
    ).toBeFocused();
    expect(
      await page
        .getByRole("link", { name: "Report this profile" })
        .evaluate((element) => getComputedStyle(element).outlineStyle),
    ).not.toBe("none");

    await page.getByRole("button", { name: "Play Profile Pulse" }).click();
    await expect(page.getByText("Now playing")).toBeVisible();
    expect(previewRequests).toHaveLength(1);
    await expect(
      page.getByRole("heading", { name: "No accepted contributions yet." }),
    ).toBeVisible();
    await expect(
      page.getByText("Awards earned in completed challenges will appear here."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Report this profile" }),
    ).toHaveAttribute(
      "href",
      `/reports/new?kind=profile&id=${publicProfileId}&label=%40ProfileCanvas`,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(forbiddenEgress).toEqual([]);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((animation) => animation.playState === "running").length,
        ),
      )
      .toBe(0);

    await page.goto("/@SparseCanvas");
    await expect(
      page.getByRole("heading", { name: "The set list is still open." }),
    ).toBeVisible();
    await expect(
      page.getByText("Awards earned in completed challenges will appear here."),
    ).toBeVisible();

    await page.goto("/@HiddenCanvas");
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });
});
