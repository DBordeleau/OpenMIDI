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
const listingId = "ea000000-0000-4000-8000-000000000001";

type DetailLoadingFrame = {
  status: string;
  body: string;
  busy: string | null;
  animationName: string | null;
  fitsViewport: boolean;
};

function seedDiscoveryFixture() {
  const sql = `
    begin;
    set constraints all deferred;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values('00000000-0000-0000-0000-000000000000','${ownerId}','authenticated','authenticated','discovery-e2e@example.test','','{}','{}',now(),now())
      on conflict (id) do nothing;
    update public.profiles set
      username='NightSignal',
      username_normalized='nightsignal',
      display_name='Night Signal',
      credit_name='Night Signal',
      profile_completed_at=now(),
      status='active',
      avatar_config=jsonb_build_object(
        'version',1,
        'seed',id::text,
        'options',jsonb_build_object(
          'eyebrowsVariant','variant04',
          'eyesVariant','variant09',
          'glassesVariant','variant02',
          'glassesProbability',100,
          'mouthVariant','variant12',
          'backgroundColor','ecad80',
          'scale',1.05,
          'rotate',-4
        )
      )
    where id='${ownerId}';
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
    insert into public.midi_library_listings(
      id,midi_pattern_id,midi_pattern_version_id,owner_id,request_id,
      request_payload_sha256,rights_payload_sha256,title,description,
      creator_username,creator_display_name,creator_credit_name,reuse_mode,
      rights_basis,attestation_version,attested_by,category_code,
      suggested_preset_id,suggested_preset_version,instrument_family_code,
      duration_ticks,duration_beats,note_count,min_pitch,max_pitch,
      polyphony_kind,search_vector
    ) values(
      '${listingId}','${patternId}','${patternVersionId}','${ownerId}',
      'ea000000-0000-4000-8000-000000000011',repeat('b',64),repeat('c',64),
      'Midnight pulse','A warm one-bar pattern for late-night arrangements.',
      'NightSignal','Night Signal','Night Signal','commercial_reuse','original',
      'midi-library-commercial-attestation-v1','${ownerId}','harmony',
      'warm-keys',1,'keys',960,2,1,60,60,'monophonic',
      to_tsvector('simple','Midnight pulse')
    ) on conflict (id) do nothing;
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
    const lineageName = page.getByText("Midnight pulse", { exact: true });
    await lineageName.scrollIntoViewIfNeeded();
    await expect(lineageName).toBeVisible();
    await expect(
      page.getByText("Created by Night Signal", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(patternVersionId, { exact: false }),
    ).toHaveCount(0);
    await expect(page.locator('img[alt=""]')).toHaveCount(2);
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

  test("streams detail-specific loading presentations without list-page copy", async ({
    page,
  }) => {
    seedDiscoveryFixture();
    await page.addInitScript(() => {
      const stored = window.sessionStorage.getItem(
        "openMidiDetailLoadingFrames",
      );
      const frames: DetailLoadingFrame[] = stored ? JSON.parse(stored) : [];
      Object.defineProperty(window, "__openMidiDetailLoadingFrames", {
        value: frames,
        configurable: true,
      });
      const capture = () => {
        const status = document.querySelector('[role="status"]');
        const busy = document.querySelector('[aria-busy="true"]');
        if (!status || !busy) return;
        const pulse = busy.querySelector(".animate-pulse");
        frames.push({
          status: status.textContent?.trim() ?? "",
          body: busy.textContent ?? "",
          busy: busy.getAttribute("aria-busy"),
          animationName: pulse ? getComputedStyle(pulse).animationName : null,
          fitsViewport: document.documentElement.scrollWidth <= innerWidth,
        });
        window.sessionStorage.setItem(
          "openMidiDetailLoadingFrames",
          JSON.stringify(frames),
        );
      };
      new MutationObserver(capture).observe(document, {
        childList: true,
        subtree: true,
      });
    });
    const avatarRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        /storage\/v1\/object/i.test(url.pathname) ||
        (!["localhost", "127.0.0.1"].includes(url.hostname) &&
          /dicebear|avatar/i.test(request.url()))
      ) {
        avatarRequests.push(request.url());
      }
    });

    await page.setViewportSize({ width: 320, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/explore");
    await expect(
      page.locator("html[data-detail-navigation-ready]"),
    ).toHaveCount(1);
    await page.getByRole("link", { name: "Midnight Discovery Signal" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Midnight Discovery Signal" }),
    ).toBeVisible();
    const streamedLineageName = page.getByText("Midnight pulse", {
      exact: true,
    });
    await expect(streamedLineageName).toHaveText("Midnight pulse");
    await expect(
      page.getByText("Created by Night Signal", { exact: true }),
    ).toHaveText("Created by Night Signal");
    await expect(
      page.getByText(patternVersionId, { exact: false }),
    ).toHaveCount(0);
    await expect(page.locator('img[alt=""]')).toHaveCount(2);
    const projectFrames: DetailLoadingFrame[] = await page.evaluate(() =>
      JSON.parse(
        window.sessionStorage.getItem("openMidiDetailLoadingFrames") ?? "[]",
      ),
    );
    expect(projectFrames).toContainEqual(
      expect.objectContaining({
        status: "Loading project details…",
        busy: "true",
        animationName: "none",
        fitsViewport: true,
      }),
    );
    expect(
      projectFrames.some((frame) => frame.body.includes("My projects")),
    ).toBe(false);
    await page.evaluate(() =>
      window.sessionStorage.removeItem("openMidiDetailLoadingFrames"),
    );

    await page.goto("/library");
    await expect(
      page.locator("html[data-detail-navigation-ready]"),
    ).toHaveCount(1);
    await page.getByRole("link", { name: "Midnight pulse" }).click();
    await expect(
      page.getByRole("heading", { name: "Midnight pulse" }),
    ).toBeVisible();
    const patternFrames: DetailLoadingFrame[] = await page.evaluate(() =>
      JSON.parse(
        window.sessionStorage.getItem("openMidiDetailLoadingFrames") ?? "[]",
      ),
    );
    expect(patternFrames).toContainEqual(
      expect.objectContaining({
        status: "Loading MIDI pattern details…",
        busy: "true",
        animationName: "none",
        fitsViewport: true,
      }),
    );
    expect(
      patternFrames.some((frame) => frame.body.includes("Find a pattern")),
    ).toBe(false);

    expect(avatarRequests).toEqual([]);
  });
});
