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

function localSql(sql: string) {
  return execFileSync(
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
      "-At",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
}

async function prepareAwardJourney() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error(
      "Refusing challenge award E2E setup outside local Supabase.",
    );
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = Date.now().toString().slice(-8);
  const actorResult = await admin.auth.admin.createUser({
    email: `challenge-awards-a-${suffix}@example.test`,
    password: "challenge-awards-local-only",
    email_confirm: true,
  });
  const secondResult = await admin.auth.admin.createUser({
    email: `challenge-awards-b-${suffix}@example.test`,
    password: "challenge-awards-local-only",
    email_confirm: true,
  });
  if (actorResult.error || !actorResult.data.user)
    throw actorResult.error ?? new Error("First award recipient not created.");
  if (secondResult.error || !secondResult.data.user)
    throw (
      secondResult.error ?? new Error("Second award recipient not created.")
    );
  const actor = actorResult.data.user;
  const second = secondResult.data.user;
  const ids = {
    project: randomUUID(),
    arrangement: randomUUID(),
    revision: randomUUID(),
    challenge: randomUUID(),
    version: randomUUID(),
    actorEntry: randomUUID(),
    secondEntry: randomUUID(),
    firstRequest: randomUUID(),
    correctionRequest: randomUUID(),
  };
  if (
    ![actor.id, second.id, ...Object.values(ids)].every((value) =>
      /^[0-9a-f-]{36}$/.test(value),
    )
  )
    throw new Error("Unsafe challenge award fixture identifier.");
  const slug = `profile-awards-${suffix}`;
  const actorUsername = `AwardA${suffix}`;
  const secondUsername = `AwardB${suffix}`;
  const challengeTitle = `Two Track Honors ${suffix}`;
  const actorTitle = `Golden Loop ${suffix}`;
  const secondTitle = `Coral Counterpoint ${suffix}`;
  localSql(`begin;
update public.profiles set username='${actorUsername}',username_normalized=lower('${actorUsername}'),display_name='Award Artist A',credit_name='Award Artist A',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible' where id='${actor.id}';
update public.profiles set username='${secondUsername}',username_normalized=lower('${secondUsername}'),display_name='Award Artist B',credit_name='Award Artist B',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible' where id='${second.id}';
insert into private.app_admins(user_id,created_by) values('${actor.id}','${actor.id}') on conflict(user_id) do nothing;
insert into public.projects(id,owner_id,create_request_id,title,license_code) values('${ids.project}','${actor.id}',gen_random_uuid(),'Award Fixture Source','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values('${ids.project}','${actor.id}','owner','${actor.id}');
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
values('${ids.arrangement}','${ids.project}','${actor.id}',gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('a',64),120,4,4,'c-minor',480,1920);
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
values('${ids.revision}','${ids.project}',1,'${actor.id}',gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('b',64),2000,'${ids.arrangement}');
update public.projects set status='active',visibility='private',published_at=statement_timestamp(),current_revision_id='${ids.revision}' where id='${ids.project}';
insert into public.challenges(id,slug,created_by,state,published_at,lifecycle_version) values('${ids.challenge}','${slug}','${actor.id}','published',statement_timestamp(),2);
insert into public.challenge_versions(id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,eligibility_terms,presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,judging_mode,official_placement_count,constraints,constraints_sha256)
values('${ids.version}','${ids.challenge}',1,'${actor.id}',gen_random_uuid(),'${challengeTitle}','Hear both exact arrangements.','A deterministic profile award fixture.','Original work only.','pulse',statement_timestamp()-interval '4 days',statement_timestamp()-interval '3 days',statement_timestamp()-interval '2 days',statement_timestamp()-interval '1 day',statement_timestamp()+interval '1 day','hybrid',2,private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}'),repeat('c',64));
update public.challenges set current_version_id='${ids.version}' where id='${ids.challenge}';
insert into public.challenge_judge_credits(challenge_version_id,position,role,display_name,credit_name) values('${ids.version}',1,'host','OpenMIDI','OpenMIDI');
insert into public.challenge_entries(id,challenge_id,challenge_version_id,entrant_id,project_id,project_revision_id,project_title_snapshot,entrant_username_snapshot,entrant_display_name_snapshot,entrant_credit_name_snapshot,revision_number_snapshot,attribution_snapshot,duration_ms_snapshot,display_attestation_version,display_attested_at,facts,evaluation,evaluation_sha256,submit_request_id,submitted_at)
values
('${ids.actorEntry}','${ids.challenge}','${ids.version}','${actor.id}','${ids.project}','${ids.revision}','${actorTitle}','${actorUsername}','Award Artist A','Award Artist A',1,'[{"kind":"publisher","creditName":"Award Artist A"}]',2000,'challenge-display-attestation-v1',statement_timestamp(),'{}','{"eligible":true}',repeat('d',64),gen_random_uuid(),statement_timestamp()-interval '3 days'),
('${ids.secondEntry}','${ids.challenge}','${ids.version}','${second.id}','${ids.project}','${ids.revision}','${secondTitle}','${secondUsername}','Award Artist B','Award Artist B',1,'[{"kind":"publisher","creditName":"Award Artist B"}]',2000,'challenge-display-attestation-v1',statement_timestamp(),'{}','{"eligible":true}',repeat('e',64),gen_random_uuid(),statement_timestamp()-interval '3 days');
insert into public.challenge_votes(challenge_id,challenge_entry_id,voter_id,state) values
('${ids.challenge}','${ids.actorEntry}','${second.id}','active'),
('${ids.challenge}','${ids.secondEntry}','${actor.id}','active');
set local role authenticated;
set local request.jwt.claim.sub='${actor.id}';
select public.finalize_challenge_result('${ids.challenge}','${ids.firstRequest}',2,'${ids.version}',null,'Both arrangements found their audience.',
  '[{"entryId":"${ids.actorEntry}","place":1,"label":"Winner"},{"entryId":"${ids.secondEntry}","place":2,"label":"Runner-up"}]',null);
commit;`);
  const firstResultId = localSql(
    `select current_result_id from public.challenges where id='${ids.challenge}';`,
  );
  return {
    actorId: actor.id,
    ids,
    slug,
    actorUsername,
    secondUsername,
    challengeTitle,
    actorTitle,
    secondTitle,
    firstResultId,
  };
}

async function preparePagedAwardJourney() {
  const env = localSupabaseEnv();
  if (!env.API_URL?.startsWith("http://127.0.0.1:") || !env.SERVICE_ROLE_KEY)
    throw new Error(
      "Refusing paged challenge award E2E setup outside local Supabase.",
    );
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = `${Date.now().toString().slice(-7)}p`;
  const ownerResult = await admin.auth.admin.createUser({
    email: `challenge-awards-paged-${suffix}@example.test`,
    password: "challenge-awards-local-only",
    email_confirm: true,
  });
  if (ownerResult.error || !ownerResult.data.user)
    throw ownerResult.error ?? new Error("Paged award owner not created.");
  const ownerId = ownerResult.data.user.id;
  const ids = {
    project: randomUUID(),
    arrangement: randomUUID(),
    revision: randomUUID(),
    challenge: randomUUID(),
    version: randomUUID(),
    request: randomUUID(),
  };
  const entrants = Array.from({ length: 27 }, (_, index) => ({
    userId: randomUUID(),
    entryId: randomUUID(),
    username: `Paged${suffix}${index.toString().padStart(2, "0")}`,
    title: `Rotated Arrangement ${index.toString().padStart(2, "0")}`,
  }));
  const userValues = entrants
    .map(
      ({ userId }, index) =>
        `('00000000-0000-0000-0000-000000000000','${userId}','authenticated','authenticated','paged-${suffix}-${index}@example.test','','{}','{}',now(),now())`,
    )
    .join(",\n");
  const profileUpdates = entrants
    .map(
      ({ userId, username }, index) =>
        `update public.profiles set username='${username}',username_normalized=lower('${username}'),display_name='Paged Artist ${index}',credit_name='Paged Artist ${index}',profile_completed_at=now(),status='active',moderation_state='visible' where id='${userId}';`,
    )
    .join("\n");
  const entryValues = entrants
    .map(
      ({ userId, entryId, username, title }, index) =>
        `('${entryId}','${ids.challenge}','${ids.version}','${userId}','${ids.project}','${ids.revision}','${title}','${username}','Paged Artist ${index}','Paged Artist ${index}',1,'[{"kind":"publisher","creditName":"Paged Artist ${index}"}]',2000,'challenge-display-attestation-v1',now(),'{}','{"eligible":true}',repeat('${((index % 9) + 1).toString()}',64),gen_random_uuid(),now()-interval '3 days')`,
    )
    .join(",\n");
  const slug = `paged-awards-${suffix}`;
  localSql(`begin;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
${userValues};
${profileUpdates}
update public.profiles set username='PagedHost${suffix}',username_normalized=lower('PagedHost${suffix}'),display_name='Paged Host',credit_name='Paged Host',profile_completed_at=now(),status='active',moderation_state='visible' where id='${ownerId}';
insert into private.app_admins(user_id,created_by) values('${ownerId}','${ownerId}');
insert into public.projects(id,owner_id,create_request_id,title,license_code) values('${ids.project}','${ownerId}',gen_random_uuid(),'Paged Award Source','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values('${ids.project}','${ownerId}','owner','${ownerId}');
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
values('${ids.arrangement}','${ids.project}','${ownerId}',gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('a',64),120,4,4,'c-minor',480,1920);
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
values('${ids.revision}','${ids.project}',1,'${ownerId}',gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('b',64),2000,'${ids.arrangement}');
update public.projects set status='active',visibility='private',published_at=now(),current_revision_id='${ids.revision}' where id='${ids.project}';
insert into public.challenges(id,slug,created_by,state,published_at,lifecycle_version) values('${ids.challenge}','${slug}','${ownerId}','published',now(),2);
insert into public.challenge_versions(id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,eligibility_terms,presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,judging_mode,official_placement_count,constraints,constraints_sha256)
values('${ids.version}','${ids.challenge}',1,'${ownerId}',gen_random_uuid(),'Paged Award Challenge','Find every exact award source.','A pagination boundary fixture.','Original work only.','sunrise',now()-interval '4 days',now()-interval '3 days',now()-interval '2 days',now()-interval '1 day',now()+interval '1 day','community',0,private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}'),repeat('c',64));
update public.challenges set current_version_id='${ids.version}' where id='${ids.challenge}';
insert into public.challenge_judge_credits(challenge_version_id,position,role,display_name,credit_name) values('${ids.version}',1,'host','OpenMIDI','OpenMIDI');
insert into public.challenge_entries(id,challenge_id,challenge_version_id,entrant_id,project_id,project_revision_id,project_title_snapshot,entrant_username_snapshot,entrant_display_name_snapshot,entrant_credit_name_snapshot,revision_number_snapshot,attribution_snapshot,duration_ms_snapshot,display_attestation_version,display_attested_at,facts,evaluation,evaluation_sha256,submit_request_id,submitted_at) values
${entryValues};
set local role authenticated;
set local request.jwt.claim.sub='${ownerId}';
select public.finalize_challenge_result('${ids.challenge}','${ids.request}',2,'${ids.version}',null,'Every visible entry tied for Community Favorite.','[]',null);
commit;`);
  const resultId = localSql(
    `select current_result_id from public.challenges where id='${ids.challenge}';`,
  );
  const target = localSql(`with first_page as (
  select public.list_public_challenge_entries('${slug}')->'entries' entries
), outside_page as (
  select e.id,e.entrant_username_snapshot,e.project_title_snapshot
  from public.challenge_result_entries re
  join public.challenge_entries e on e.id=re.challenge_entry_id
  where re.challenge_result_id='${resultId}'
    and not exists(select 1 from first_page,jsonb_array_elements(entries) item where item->>'entryId'=e.id::text)
  order by e.id limit 1
)
select id||'|'||entrant_username_snapshot||'|'||project_title_snapshot from outside_page;`);
  const [entryId, username, title] = target.split("|");
  if (!entryId || !username || !title)
    throw new Error("No award recipient found outside the first entry page.");
  return { slug, resultId, entryId, username, title };
}

test.describe("challenge profile awards", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("shows exact current-result awards signed out and replaces presentation after correction", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const fixture = await prepareAwardJourney();
    const anonymous = await browser.newContext({
      baseURL: "http://localhost:3100",
    });
    const page = await anonymous.newPage();

    await page.goto(`/@${fixture.actorUsername}`);
    const actorAwards = page.getByRole("region", { name: "Awards" });
    await expect(actorAwards.getByRole("article")).toHaveCount(2);
    await expect(
      actorAwards.getByRole("heading", { name: "Challenge Winner" }),
    ).toBeVisible();
    await expect(
      actorAwards.getByRole("heading", { name: "Community Favorite" }),
    ).toBeVisible();
    const resultLink = actorAwards.getByRole("link", {
      name: /Challenge Winner for Two Track Honors/,
    });
    await expect(resultLink).toHaveAttribute(
      "href",
      `/challenges/${fixture.slug}?result=${fixture.firstResultId}&entry=${fixture.ids.actorEntry}#entry-${fixture.ids.actorEntry}`,
    );
    await resultLink.click();
    await expect(page).toHaveURL(
      new RegExp(
        `/challenges/${fixture.slug}\\?result=${fixture.firstResultId}&entry=${fixture.ids.actorEntry}#entry-${fixture.ids.actorEntry}$`,
      ),
    );
    const permanentResult = page.getByRole("region", {
      name: "Official results",
    });
    await expect(permanentResult).toBeVisible();
    await expect(
      permanentResult.getByText(fixture.actorTitle, { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/projectId|voterId|moderation reason|private project/i),
    ).toHaveCount(0);

    await page.goto(`/@${fixture.secondUsername}`);
    const secondAwards = page.getByRole("region", { name: "Awards" });
    await expect(secondAwards.getByRole("article")).toHaveCount(2);
    await expect(
      secondAwards.getByRole("heading", { name: "Top Placement" }),
    ).toBeVisible();
    await expect(
      secondAwards.getByRole("heading", { name: "Community Favorite" }),
    ).toBeVisible();

    localSql(`begin;
set local role authenticated;
set local request.jwt.claim.sub='${fixture.actorId}';
select public.finalize_challenge_result('${fixture.ids.challenge}','${fixture.ids.correctionRequest}',3,'${fixture.ids.version}','${fixture.firstResultId}','Corrected official order.',
  '[{"entryId":"${fixture.ids.secondEntry}","place":1,"label":"Winner"},{"entryId":"${fixture.ids.actorEntry}","place":2,"label":"Runner-up"}]','Private correction evidence');
commit;`);
    const correctedResultId = localSql(
      `select current_result_id from public.challenges where id='${fixture.ids.challenge}';`,
    );
    expect(correctedResultId).not.toBe(fixture.firstResultId);

    await page.goto(`/@${fixture.actorUsername}`);
    const correctedActorAwards = page.getByRole("region", { name: "Awards" });
    await expect(correctedActorAwards.getByRole("article")).toHaveCount(2);
    await expect(
      correctedActorAwards.getByRole("heading", { name: "Top Placement" }),
    ).toBeVisible();
    await expect(
      correctedActorAwards.getByRole("heading", { name: "Challenge Winner" }),
    ).toHaveCount(0);
    await expect(
      correctedActorAwards.getByText("Private correction evidence"),
    ).toHaveCount(0);
    await expect(
      correctedActorAwards.getByRole("link", { name: /Top Placement/ }),
    ).toHaveAttribute(
      "href",
      `/challenges/${fixture.slug}?result=${correctedResultId}&entry=${fixture.ids.actorEntry}#entry-${fixture.ids.actorEntry}`,
    );
    const staleResponse = await page.goto(
      `/challenges/${fixture.slug}?result=${fixture.firstResultId}&entry=${fixture.ids.actorEntry}#entry-${fixture.ids.actorEntry}`,
    );
    expect(staleResponse?.status()).toBe(404);

    await page.goto(`/@${fixture.secondUsername}`);
    const correctedSecondAwards = page.getByRole("region", { name: "Awards" });
    await expect(correctedSecondAwards.getByRole("article")).toHaveCount(2);
    await expect(
      correctedSecondAwards.getByRole("heading", { name: "Challenge Winner" }),
    ).toBeVisible();
    await expect(
      correctedSecondAwards.getByRole("heading", { name: "Top Placement" }),
    ).toHaveCount(0);
    await anonymous.close();
  });

  test("reaches an exact awarded entry outside the first 25-entry rotation page", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const fixture = await preparePagedAwardJourney();
    const anonymous = await browser.newContext({
      baseURL: "http://localhost:3100",
    });
    const page = await anonymous.newPage();

    await page.goto(`/challenges/${fixture.slug}`);
    const rotatedEntries = page.getByRole("region", {
      name: "Challenge entries",
    });
    await expect(rotatedEntries.locator("ul > li")).toHaveCount(25);
    await expect(
      rotatedEntries.getByText(fixture.title, { exact: true }),
    ).toHaveCount(0);

    await page.goto(`/@${fixture.username}`);
    const awardLink = page
      .getByRole("region", { name: "Awards" })
      .getByRole("link", { name: /Community Favorite/ });
    await expect(awardLink).toHaveAttribute(
      "href",
      `/challenges/${fixture.slug}?result=${fixture.resultId}&entry=${fixture.entryId}#entry-${fixture.entryId}`,
    );
    await awardLink.click();
    const exactTarget = page.getByRole("region", { name: "Exact award entry" });
    await expect(exactTarget).toBeVisible();
    await expect(
      exactTarget.getByText(fixture.title, { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(
        `/challenges/${fixture.slug}\\?result=${fixture.resultId}&entry=${fixture.entryId}#entry-${fixture.entryId}$`,
      ),
    );
    await anonymous.close();
  });
});
