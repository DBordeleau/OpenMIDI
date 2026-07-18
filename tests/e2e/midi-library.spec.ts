import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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
      .filter(Boolean)
      .map((match) => [match![1], match![2]]),
  );
}
async function seedLibraryActor() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing library E2E setup outside local Supabase.");
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const actor = users.data.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!actor) throw new Error("Local library actor is missing.");
  const patternId = randomUUID(),
    versionId = randomUUID(),
    patternRequest = randomUUID(),
    versionRequest = randomUUID(),
    noteOne = randomUUID(),
    noteTwo = randomUUID();
  const title = `Library Pulse ${Date.now()}`;
  for (const value of [
    actor.id,
    patternId,
    versionId,
    patternRequest,
    versionRequest,
    noteOne,
    noteTwo,
  ])
    if (!/^[0-9a-f-]{36}$/.test(value))
      throw new Error("Unsafe library fixture identifier.");
  const sql = `begin; update public.profiles set username='LibraryE2E',username_normalized='librarye2e',display_name='Library E2E',credit_name='Library E2E',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible',purged_at=null where id='${actor.id}'; insert into public.midi_patterns(id,owner_id,create_request_id,name) values('${patternId}','${actor.id}','${patternRequest}','${title}'); insert into public.midi_pattern_versions(id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,ppq,duration_ticks,note_count,content_sha256) values('${versionId}','${patternId}',1,'${versionRequest}','${actor.id}','Library E2E',480,1920,2,repeat('c',64)); insert into public.midi_pattern_notes(midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity) values('${versionId}','${noteOne}',0,480,60,100),('${versionId}','${noteTwo}',960,480,64,96); commit;`;
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
  return { title };
}

async function seedLibraryDetailFixture() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing LIB-02 E2E setup outside local Supabase.");
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const reporter = users.data.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!reporter) throw new Error("Local LIB-02 reporter is missing.");
  const ownerEmail = "library-detail-owner@example.test";
  let owner = users.data.users.find((user) => user.email === ownerEmail);
  if (!owner) {
    const created = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: "library-detail-local-only",
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("LIB-02 owner was not created.");
    owner = created.data.user;
  }
  const ids = Object.fromEntries(
    [
      "pattern",
      "version1",
      "version2",
      "note1",
      "note2",
      "listing",
      "credit",
      "project",
      "arrangement",
      "track",
      "clip1",
      "clip2",
      "revision",
      "reuseProject",
      "reuseWorkspace",
      "referencePattern",
      "referenceVersion",
      "referenceNote",
      "referenceListing",
    ].map((key) => [key, randomUUID()]),
  ) as Record<string, string>;
  const title = `History Detail ${Date.now()}`;
  const values = [reporter.id, owner.id, ...Object.values(ids)];
  if (!values.every((value) => /^[0-9a-f-]{36}$/.test(value)))
    throw new Error("Unsafe LIB-02 fixture identifier.");
  const sql = `begin;
update public.profiles set username='LibraryReporter',username_normalized='libraryreporter',display_name='Library Reporter',credit_name='Library Reporter',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible',purged_at=null where id='${reporter.id}';
update public.profiles set username='LibraryDetailOwner',username_normalized='librarydetailowner',display_name='Library Detail Owner',credit_name='Library Detail Owner',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible',purged_at=null where id='${owner.id}';
insert into public.midi_patterns(id,owner_id,create_request_id,name,visibility,rights_attestation_version,published_at) values('${ids.pattern}','${owner.id}',gen_random_uuid(),'${title}','public','cc-by-4.0-attestation-v1',statement_timestamp());
insert into public.midi_pattern_versions(id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,parent_pattern_version_id,source_pattern_version_id,ppq,duration_ticks,note_count,content_sha256,reuse_license_code,reuse_license_version,reuse_license_url) values
('${ids.version1}','${ids.pattern}',1,gen_random_uuid(),'${owner.id}','Library Detail Owner',null,null,480,960,1,repeat('a',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/'),
('${ids.version2}','${ids.pattern}',2,gen_random_uuid(),'${owner.id}','Library Detail Owner','${ids.version1}','${ids.version1}',480,960,2,repeat('b',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/');
insert into public.midi_pattern_notes(midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity) values
('${ids.version1}','${ids.note1}',0,240,60,90),('${ids.version2}','${ids.note1}',0,480,62,96),('${ids.version2}','${ids.note2}',480,240,67,84);
insert into public.midi_library_listings(id,midi_pattern_id,midi_pattern_version_id,owner_id,request_id,request_payload_sha256,rights_payload_sha256,title,description,creator_username,creator_display_name,creator_credit_name,reuse_mode,rights_basis,attestation_version,attested_by,supporting_source_url,supporting_source_terms,category_code,suggested_preset_id,suggested_preset_version,instrument_family_code,duration_ticks,duration_beats,note_count,min_pitch,max_pitch,polyphony_kind,search_vector)
values('${ids.listing}','${ids.pattern}','${ids.version1}','${owner.id}',gen_random_uuid(),repeat('c',64),repeat('d',64),'${title}','A detail, history, and moderation browser fixture.','LibraryDetailOwner','Library Detail Owner','Library Detail Owner','commercial_reuse','authorized_adaptation','midi-library-commercial-attestation-v1','${owner.id}','https://example.test/source','Compatible source permission','melody','soft-lead',1,'leads',960,2,1,60,60,'monophonic',to_tsvector('simple','${title}'));
insert into public.midi_pattern_external_credits(id,listing_id,midi_pattern_version_id,position,credited_name,role,source_url,source_terms) values('${ids.credit}','${ids.listing}','${ids.version1}',1,'External Composer','Composer','https://example.test/source','Compatible source permission');
insert into public.midi_patterns(id,owner_id,create_request_id,name) values('${ids.referencePattern}','${owner.id}',gen_random_uuid(),'Reference-only browser study');
insert into public.midi_pattern_versions(id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,ppq,duration_ticks,note_count,content_sha256) values('${ids.referenceVersion}','${ids.referencePattern}',1,gen_random_uuid(),'${owner.id}','Library Detail Owner',480,960,1,repeat('9',64));
insert into public.midi_pattern_notes(midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity) values('${ids.referenceVersion}','${ids.referenceNote}',0,480,67,90);
insert into public.midi_library_listings(id,midi_pattern_id,midi_pattern_version_id,owner_id,request_id,request_payload_sha256,rights_payload_sha256,title,description,creator_username,creator_display_name,creator_credit_name,reuse_mode,rights_basis,attestation_version,attested_by,category_code,suggested_preset_id,suggested_preset_version,instrument_family_code,duration_ticks,duration_beats,note_count,min_pitch,max_pitch,polyphony_kind,search_vector)
values('${ids.referenceListing}','${ids.referencePattern}','${ids.referenceVersion}','${owner.id}',gen_random_uuid(),repeat('7',64),repeat('8',64),'Reference-only browser study','Listening and inspection only.','LibraryDetailOwner','Library Detail Owner','Library Detail Owner','reference_only','original','midi-library-reference-display-attestation-v1','${owner.id}','melody','soft-lead',1,'leads',960,2,1,67,67,'monophonic',to_tsvector('simple','Reference-only browser study'));
insert into public.projects(id,owner_id,create_request_id,title,license_code) values('${ids.project}','${owner.id}',gen_random_uuid(),'Public usage fixture','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values('${ids.project}','${owner.id}','owner','${owner.id}');
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks) values('${ids.arrangement}','${ids.project}','${owner.id}',gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('e',64),120,4,4,'c-major',480,960);
insert into public.arrangement_tracks(arrangement_version_id,project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed) values('${ids.arrangement}','${ids.project}','${ids.track}',0,'Lead','soft-lead',1,-6,0,false,false);
insert into public.arrangement_clips(arrangement_version_id,project_id,track_id,clip_id,midi_pattern_version_id,start_tick,duration_ticks,source_start_tick,loop) values
('${ids.arrangement}','${ids.project}','${ids.track}','${ids.clip1}','${ids.version1}',0,960,0,false),('${ids.arrangement}','${ids.project}','${ids.track}','${ids.clip2}','${ids.version2}',0,960,0,false);
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id) values('${ids.revision}','${ids.project}',1,'${owner.id}',gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('f',64),1000,'${ids.arrangement}');
update public.projects set visibility='public',status='active',current_revision_id='${ids.revision}',published_at=statement_timestamp(),bpm=120,musical_key='c-major',rights_attestation_version='cc-by-4.0-reuse-attestation-v1' where id='${ids.project}';
insert into public.projects(id,owner_id,create_request_id,title,license_code) values('${ids.reuseProject}','${reporter.id}',gen_random_uuid(),'Private library sketch','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values('${ids.reuseProject}','${reporter.id}','owner','${reporter.id}');
with m as (select jsonb_build_object('manifestVersion',3,'engine','jam-session-midi','engineVersion','jam-session-midi-3_tone-15.1.22_presets-1','projectId','${ids.reuseProject}'::uuid,'workspaceId','${ids.reuseWorkspace}'::uuid,'tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'musicalKey','c-major','ppq',480,'durationTicks',1920,'tracks','[]'::jsonb) manifest)
insert into public.workspaces(id,project_id,owner_id,create_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256)
select '${ids.reuseWorkspace}','${ids.reuseProject}','${reporter.id}',gen_random_uuid(),manifest,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',encode(extensions.digest(convert_to(manifest::text,'UTF8'),'sha256'),'hex') from m;
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
  return {
    title,
    listingId: ids.listing,
    referenceListingId: ids.referenceListing,
    reuseProjectId: ids.reuseProject,
    reporterId: reporter.id,
  };
}

function grantLibraryAdmin(userId: string) {
  if (!/^[0-9a-f-]{36}$/.test(userId))
    throw new Error("Unsafe admin fixture identifier.");
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
      `insert into private.app_admins(user_id,created_by) values('${userId}','${userId}') on conflict(user_id) do nothing`,
    ],
    { encoding: "utf8" },
  );
}

test.describe("public MIDI library", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );
  test("owner lists, anonymous visitor filters and previews, then owner unlists", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const fixture = await seedLibraryActor();
    const forbidden: string[] = [];
    page.on("request", (request) => {
      if (/storage\/v1\/object/i.test(request.url()))
        forbidden.push(request.url());
    });
    await page.goto("/test-auth");
    await Promise.all([
      page.waitForURL(/\/onboarding$/),
      page.getByRole("button", { name: "Sign in test actor" }).click(),
    ]);
    await page.goto("/library/manage");
    await expect(
      page.getByRole("heading", { name: /Share one exact version/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Pattern version")).toContainText(
      fixture.title,
    );
    await page
      .getByLabel("Listing note")
      .fill("A compact reference pulse for listening and study.");
    await page.getByLabel("Suggested bundled preset").selectOption("warm-keys");
    await page
      .getByRole("checkbox", { name: /I affirm this rights basis/ })
      .check();
    await page.getByRole("button", { name: "Publish listing" }).click();
    await expect(page.getByRole("status")).toContainText("now listed");
    await expect(page.getByRole("button", { name: "Unlist" })).toBeVisible();
    const anonymous = await browser.newPage();
    anonymous.on("request", (request) => {
      if (/storage\/v1\/object/i.test(request.url()))
        forbidden.push(request.url());
    });
    await anonymous.goto(
      `/library?rights=reference_only&family=keys&q=${encodeURIComponent(fixture.title)}`,
    );
    await expect(anonymous).toHaveURL(/rights=reference_only/);
    await expect(anonymous.getByLabel("Instrument family")).toHaveValue("keys");
    await expect(
      anonymous.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();
    await expect(
      anonymous.getByText("Reference only — reuse not granted"),
    ).toBeVisible();
    await anonymous
      .getByRole("button", { name: `Play ${fixture.title}` })
      .click();
    await expect(anonymous.getByText(/Now playing/)).toBeVisible();
    await page.getByRole("button", { name: "Unlist" }).click();
    await expect(page.getByRole("status")).toContainText(
      "no longer discoverable",
    );
    await anonymous.reload();
    await expect(
      anonymous.getByRole("heading", { name: fixture.title }),
    ).toHaveCount(0);
    expect(forbidden).toEqual([]);
    await anonymous.close();
  });

  test("visitor inspects history and DIFF, reports privately, then an admin hides and restores", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const fixture = await seedLibraryDetailFixture();
    const anonymous = await browser.newContext({
      baseURL: "http://localhost:3100",
    });
    const publicPage = await anonymous.newPage();
    await publicPage.goto(`/library/${fixture.listingId}`);
    await expect(
      publicPage.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();
    await expect(publicPage.getByText("External Composer")).toBeVisible();
    await expect(
      publicPage.getByRole("heading", { name: "Compare exact versions" }),
    ).toBeVisible();
    await expect(publicPage.getByLabel("From version")).toContainText(
      "Version 1",
    );
    await expect(publicPage.getByLabel("To version")).toContainText(
      "Version 2",
    );
    await expect(
      publicPage.getByRole("button", { name: /Changed/ }),
    ).toBeVisible();

    await page.goto("/test-auth");
    await Promise.all([
      page.waitForURL(/\/onboarding$/),
      page.getByRole("button", { name: "Sign in test actor" }).click(),
    ]);
    await page.goto(`/library/${fixture.listingId}`);
    await page
      .getByRole("button", { name: "Report unoriginal or unauthorized work" })
      .click();
    await page
      .getByLabel("Your relationship to the work")
      .selectOption("observer");
    await page
      .getByLabel(/Original work title/)
      .fill("Original browser fixture");
    await page.getByLabel(/Source URL/).fill("https://example.test/original");
    await page
      .getByLabel("Private evidence")
      .fill(
        "The note sequence appears to match the linked original browser fixture.",
      );
    await page.getByRole("button", { name: "Send private report" }).click();
    await expect(page.getByText("Report received")).toBeVisible();
    await expect(
      publicPage.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();

    grantLibraryAdmin(fixture.reporterId);
    await page.goto("/admin/library-moderation");
    await Promise.all([
      page.waitForURL(/\/admin\/library-moderation\/[^/]+$/),
      page.getByRole("link", { name: fixture.title }).click(),
    ]);
    const reportUrl = page.url();
    await page.getByLabel("Action").selectOption("assign_self");
    await page
      .getByLabel("Decision note")
      .fill("Assign this focused browser rights review to me.");
    await page.getByRole("button", { name: "Apply action" }).click();
    await expect(
      page.getByText("The moderation action was recorded."),
    ).toBeVisible();
    await page.getByLabel("Action").selectOption("hide");
    await page
      .getByLabel("Decision note")
      .fill("Hide during focused browser rights review.");
    await page.getByRole("button", { name: "Apply action" }).click();
    await expect(
      page.getByText("The moderation action was recorded."),
    ).toBeVisible();
    await publicPage.goto(`/library/${fixture.listingId}`);
    await expect(
      publicPage.getByRole("heading", { name: fixture.title }),
    ).toHaveCount(0);

    await page.goto(reportUrl);
    await page.getByLabel("Action").selectOption("restore");
    await page
      .getByLabel("Decision note")
      .fill("Restore after focused browser rights review.");
    await page.getByRole("button", { name: "Apply action" }).click();
    await expect(
      page.getByText("The moderation action was recorded."),
    ).toBeVisible();
    await publicPage.goto(`/library/${fixture.listingId}`);
    await expect(
      publicPage.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();
    await anonymous.close();
  });

  test("member saves and imports a commercial version while reference-only reuse stays denied", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const fixture = await seedLibraryDetailFixture();
    await page.goto("/test-auth");
    await Promise.all([
      page.waitForURL(/\/onboarding$/),
      page.getByRole("button", { name: "Sign in test actor" }).click(),
    ]);
    await page.goto(`/library/${fixture.listingId}`);
    await page.getByRole("button", { name: "Save clip" }).click();
    await expect(page.getByText("Saved to your private clips.")).toBeVisible();
    await page.goto("/library/saved");
    await expect(
      page.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();
    const savedCard = page
      .locator("article")
      .filter({ hasText: fixture.title });
    await expect(savedCard.getByText("External Composer")).toBeVisible();
    await expect(
      savedCard.getByText(/Commercial reuse · CC BY 4.0/).first(),
    ).toBeVisible();
    await savedCard
      .getByRole("button", { name: "Import exact version" })
      .click();
    await expect(
      page.getByText("Exact version imported into the private workspace."),
    ).toBeVisible();
    await page.goto(`/studio/${fixture.reuseProjectId}`);
    await expect(
      page.getByText(fixture.title, { exact: true }).first(),
    ).toBeVisible();

    await page.goto(`/library/${fixture.referenceListingId}`);
    await expect(
      page.getByText(/Reference-only listings cannot be saved/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Save clip" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Import exact version" }),
    ).toHaveCount(0);
  });
});
