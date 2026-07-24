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

async function seedClipCollectionFixture() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing collection E2E setup outside local Supabase.");

  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const actor = users.data.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!actor) throw new Error("Local collection actor is missing.");

  const ownerEmail = "collection-source-owner@example.test";
  let owner = users.data.users.find((user) => user.email === ownerEmail);
  if (!owner) {
    const created = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: "collection-local-only",
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw (
        created.error ?? new Error("Collection source owner was not created.")
      );
    owner = created.data.user;
  }

  const ids = Object.fromEntries(
    [
      "ownedPattern",
      "ownedV1",
      "ownedV2",
      "ownedNote1",
      "ownedNote2",
      "savedPattern",
      "savedVersion",
      "savedNote",
      "savedListing",
      "hiddenPattern",
      "hiddenVersion",
      "hiddenNote",
      "hiddenListing",
      "project",
      "workspace",
    ].map((key) => [key, randomUUID()]),
  ) as Record<string, string>;
  const ownedTitle = `Collection Pulse ${Date.now()}`;
  const savedTitle = `Saved Counterline ${Date.now()}`;
  const hiddenTitle = `Unavailable Bookmark ${Date.now()}`;
  if (
    ![actor.id, owner.id, ...Object.values(ids)].every((value) =>
      /^[0-9a-f-]{36}$/.test(value),
    )
  )
    throw new Error("Unsafe collection fixture identifier.");

  const sql = `begin;
update public.profiles set username='CollectionE2E',username_normalized='collectione2e',display_name='Collection E2E',credit_name='Collection E2E',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible',purged_at=null where id='${actor.id}';
update public.profiles set username='CollectionSource',username_normalized='collectionsource',display_name='Collection Source',credit_name='Collection Source',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible',purged_at=null where id='${owner.id}';
insert into public.midi_patterns(id,owner_id,create_request_id,name) values
('${ids.ownedPattern}','${actor.id}',gen_random_uuid(),'${ownedTitle}'),
('${ids.savedPattern}','${owner.id}',gen_random_uuid(),'${savedTitle}'),
('${ids.hiddenPattern}','${owner.id}',gen_random_uuid(),'${hiddenTitle}');
insert into public.midi_pattern_versions(id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,parent_pattern_version_id,source_pattern_version_id,ppq,duration_ticks,note_count,content_sha256,reuse_license_code,reuse_license_version,reuse_license_url) values
('${ids.ownedV1}','${ids.ownedPattern}',1,gen_random_uuid(),'${actor.id}','Collection E2E',null,null,480,960,1,repeat('1',64),null,null,null),
('${ids.ownedV2}','${ids.ownedPattern}',2,gen_random_uuid(),'${actor.id}','Collection E2E','${ids.ownedV1}','${ids.ownedV1}',480,1440,1,repeat('2',64),null,null,null),
('${ids.savedVersion}','${ids.savedPattern}',1,gen_random_uuid(),'${owner.id}','Collection Source',null,null,480,960,1,repeat('3',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/'),
('${ids.hiddenVersion}','${ids.hiddenPattern}',1,gen_random_uuid(),'${owner.id}','Collection Source',null,null,480,960,1,repeat('4',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/');
insert into public.midi_pattern_notes(midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity) values
('${ids.ownedV1}','${ids.ownedNote1}',0,480,60,96),
('${ids.ownedV2}','${ids.ownedNote2}',240,720,64,100),
('${ids.savedVersion}','${ids.savedNote}',0,480,55,96),
('${ids.hiddenVersion}','${ids.hiddenNote}',0,480,67,90);
insert into public.midi_library_listings(id,midi_pattern_id,midi_pattern_version_id,owner_id,request_id,request_payload_sha256,rights_payload_sha256,title,description,creator_username,creator_display_name,creator_credit_name,reuse_mode,rights_basis,attestation_version,attested_by,category_code,suggested_preset_id,suggested_preset_version,instrument_family_code,duration_ticks,duration_beats,note_count,min_pitch,max_pitch,polyphony_kind,search_vector,moderation_hidden_at) values
('${ids.savedListing}','${ids.savedPattern}','${ids.savedVersion}','${owner.id}',gen_random_uuid(),repeat('5',64),repeat('6',64),'${savedTitle}','Reusable saved collection fixture.','CollectionSource','Collection Source','Collection Source','commercial_reuse','original','midi-library-commercial-attestation-v1','${owner.id}','melody','warm-keys',1,'keys',960,2,1,55,55,'monophonic',to_tsvector('simple','${savedTitle}'),null),
('${ids.hiddenListing}','${ids.hiddenPattern}','${ids.hiddenVersion}','${owner.id}',gen_random_uuid(),repeat('7',64),repeat('8',64),'${hiddenTitle}','Hidden saved collection fixture.','CollectionSource','Collection Source','Collection Source','commercial_reuse','original','midi-library-commercial-attestation-v1','${owner.id}','melody','warm-keys',1,'keys',960,2,1,67,67,'monophonic',to_tsvector('simple','${hiddenTitle}'),statement_timestamp());
insert into public.saved_midi_patterns(user_id,midi_pattern_version_id,source_listing_id,save_request_id) values
('${actor.id}','${ids.savedVersion}','${ids.savedListing}',gen_random_uuid()),
('${actor.id}','${ids.hiddenVersion}','${ids.hiddenListing}',gen_random_uuid());
insert into public.projects(id,owner_id,create_request_id,title,license_code) values('${ids.project}','${actor.id}',gen_random_uuid(),'Collection workspace','all-rights-reserved');
insert into public.project_members(project_id,user_id,role,created_by) values('${ids.project}','${actor.id}','owner','${actor.id}');
with m as (select jsonb_build_object('manifestVersion',3,'engine','openmidi-midi','engineVersion','openmidi-midi-3_tone-15.1.22_presets-1','projectId','${ids.project}'::uuid,'workspaceId','${ids.workspace}'::uuid,'tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'musicalKey','c-major','ppq',480,'durationTicks',1920,'tracks','[]'::jsonb) manifest)
insert into public.workspaces(id,project_id,owner_id,create_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256)
select '${ids.workspace}','${ids.project}','${actor.id}',gen_random_uuid(),manifest,3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',encode(extensions.digest(convert_to(manifest::text,'UTF8'),'sha256'),'hex') from m;
commit;`;
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

  return {
    ownedTitle,
    savedTitle,
    hiddenTitle,
    projectId: ids.project,
  };
}

test.describe("unified clip collection", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("uses latest-owned and exact-saved semantics across collection and Studio", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const fixture = await seedClipCollectionFixture();
    const forbidden: string[] = [];
    const serverActions: string[] = [];
    page.on("request", (request) => {
      if (
        /storage\/v1\/object|functions\/v1|dicebear|avatar.*(?:png|svg)|\.(?:mp3|wav|ogg)(?:\?|$)/i.test(
          request.url(),
        )
      )
        forbidden.push(request.url());
      if (request.method() === "POST" && request.headers()["next-action"])
        serverActions.push(request.headers()["next-action"]!);
    });

    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    serverActions.length = 0;
    await page.goto("/library/collection");
    await expect(page).toHaveURL(/\/library\/collection$/);
    const ownedCard = page
      .locator("article")
      .filter({ hasText: fixture.ownedTitle });
    await expect(ownedCard).toHaveCount(1);
    await expect(ownedCard.getByText("v2")).toBeVisible();
    await expect(ownedCard.getByText("2 versions")).toBeVisible();
    expect(serverActions).toEqual([]);

    await ownedCard
      .getByRole("button", { name: `Preview ${fixture.ownedTitle}` })
      .click();
    await expect(
      ownedCard.getByRole("button", { name: `Pause ${fixture.ownedTitle}` }),
    ).toBeVisible();
    expect(serverActions).toHaveLength(1);

    await page.getByRole("link", { name: "Saved clips" }).click();
    await expect(page).toHaveURL(/source=saved/);
    const savedCard = page
      .locator("article")
      .filter({ hasText: fixture.savedTitle });
    await expect(savedCard).toBeVisible();
    await expect(savedCard.getByText("Exact bookmark")).toBeVisible();
    await expect(
      savedCard.getByRole("button", { name: "Import exact version" }),
    ).toBeEnabled();
    const hiddenCard = page
      .locator("article")
      .filter({ hasText: fixture.hiddenTitle });
    await expect(hiddenCard).toBeVisible();
    await expect(hiddenCard.getByText(/under review/i)).toBeVisible();
    await expect(
      hiddenCard.getByRole("button", {
        name: `Preview ${fixture.hiddenTitle}`,
      }),
    ).toBeDisabled();
    await expect(
      hiddenCard.getByRole("button", { name: "Import exact version" }),
    ).toHaveCount(0);

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        )
        .toBe(true);
    }

    await page.goto("/library/saved?source=owned&q=ignored");
    await expect(page).toHaveURL(/\/library\/collection\?source=saved$/);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/studio/${fixture.projectId}`);
    await page.getByRole("button", { name: "Add from clips" }).click();
    const drawer = page.getByRole("dialog", { name: "Add from clips" });
    await expect(drawer).toBeVisible();
    const drawerOwned = drawer
      .locator("[data-clip-version]")
      .filter({ hasText: fixture.ownedTitle });
    await expect(drawerOwned).toHaveCount(1);
    await expect(drawerOwned.getByText("v2")).toBeVisible();
    await expect(drawerOwned.getByText("2 versions")).toBeVisible();
    await drawerOwned.getByRole("button", { name: "Add as new track" }).click();
    await expect(
      page.getByText(
        `${fixture.ownedTitle} was added on a new track at the playhead.`,
      ),
    ).toBeVisible({ timeout: 15_000 });

    expect(forbidden).toEqual([]);
  });
});
