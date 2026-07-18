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

async function prepareVotingJourney() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error(
      "Refusing challenge voting E2E setup outside local Supabase.",
    );
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const actor = users.data.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!actor) throw new Error("Local challenge voter is missing.");
  const secondEmail = "challenge-voting-second@example.test";
  let second = users.data.users.find((user) => user.email === secondEmail);
  if (!second) {
    const created = await admin.auth.admin.createUser({
      email: secondEmail,
      password: "challenge-voting-local-only",
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("Second challenge entrant not created.");
    second = created.data.user;
  }
  const ids = {
    project: randomUUID(),
    arrangement: randomUUID(),
    revision: randomUUID(),
    challenge: randomUUID(),
    version: randomUUID(),
    actorEntry: randomUUID(),
    secondEntry: randomUUID(),
  };
  if (
    ![actor.id, second.id, ...Object.values(ids)].every((value) =>
      /^[0-9a-f-]{36}$/.test(value),
    )
  )
    throw new Error("Unsafe challenge voting fixture identifier.");
  const stamp = Date.now();
  const slug = `vote-results-${stamp}`;
  const actorTitle = `My Exact Entry ${stamp}`;
  const secondTitle = `Other Exact Entry ${stamp}`;
  const resultNote = `Permanent result ${stamp}`;
  localSql(`begin;
update public.profiles set username='VoteActor',username_normalized='voteactor',display_name='Vote Actor',credit_name='Vote Actor',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible' where id='${actor.id}';
update public.profiles set username='VoteSecond',username_normalized='votesecond',display_name='Vote Second',credit_name='Vote Second',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible' where id='${second.id}';
insert into private.app_admins(user_id,created_by) values('${actor.id}','${actor.id}') on conflict(user_id) do nothing;
insert into public.projects(id,owner_id,create_request_id,title,license_code) values('${ids.project}','${actor.id}',gen_random_uuid(),'Voting Fixture Source','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values('${ids.project}','${actor.id}','owner','${actor.id}');
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
values('${ids.arrangement}','${ids.project}','${actor.id}',gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('a',64),120,4,4,'c-minor',480,1920);
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
values('${ids.revision}','${ids.project}',1,'${actor.id}',gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('b',64),2000,'${ids.arrangement}');
update public.projects set status='active',visibility='private',published_at=statement_timestamp(),current_revision_id='${ids.revision}' where id='${ids.project}';
insert into public.challenges(id,slug,created_by,state,published_at,lifecycle_version) values('${ids.challenge}','${slug}','${actor.id}','published',statement_timestamp(),2);
insert into public.challenge_versions(id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,eligibility_terms,presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,judging_mode,official_placement_count,constraints,constraints_sha256)
values('${ids.version}','${ids.challenge}',1,'${actor.id}',gen_random_uuid(),'Voting Result Journey','Hear both ideas before choosing.','A deterministic browser voting fixture.','Original work only.','pulse',statement_timestamp()-interval '4 days',statement_timestamp()-interval '2 days',statement_timestamp()-interval '1 day',statement_timestamp()+interval '1 day',statement_timestamp()+interval '2 days','hybrid',1,private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}'),repeat('c',64));
update public.challenges set current_version_id='${ids.version}' where id='${ids.challenge}';
insert into public.challenge_judge_credits(challenge_version_id,position,role,display_name,credit_name) values('${ids.version}',1,'host','OpenMIDI','OpenMIDI');
insert into public.challenge_entries(id,challenge_id,challenge_version_id,entrant_id,project_id,project_revision_id,project_title_snapshot,entrant_username_snapshot,entrant_display_name_snapshot,entrant_credit_name_snapshot,revision_number_snapshot,attribution_snapshot,duration_ms_snapshot,display_attestation_version,display_attested_at,facts,evaluation,evaluation_sha256,submit_request_id,submitted_at)
values
('${ids.actorEntry}','${ids.challenge}','${ids.version}','${actor.id}','${ids.project}','${ids.revision}','${actorTitle}','VoteActor','Vote Actor','Vote Actor',1,'[{"kind":"publisher","creditName":"Vote Actor"}]',2000,'challenge-display-attestation-v1',statement_timestamp(),
'{"trackCount":1,"distinctInstrumentCount":0,"presetVersions":[],"families":[],"tempoBpm":120,"timeSignature":{"numerator":4,"denominator":4},"musicalKey":"c-minor"}',
private.evaluate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}','{"trackCount":1,"distinctInstrumentCount":0,"presetVersions":[],"families":[],"tempoBpm":120,"timeSignature":{"numerator":4,"denominator":4},"musicalKey":"c-minor"}'),repeat('d',64),gen_random_uuid(),statement_timestamp()-interval '2 days'),
('${ids.secondEntry}','${ids.challenge}','${ids.version}','${second.id}','${ids.project}','${ids.revision}','${secondTitle}','VoteSecond','Vote Second','Vote Second',1,'[{"kind":"publisher","creditName":"Vote Second"}]',2000,'challenge-display-attestation-v1',statement_timestamp(),
'{"trackCount":1,"distinctInstrumentCount":0,"presetVersions":[],"families":[],"tempoBpm":120,"timeSignature":{"numerator":4,"denominator":4},"musicalKey":"c-minor"}',
private.evaluate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}','{"trackCount":1,"distinctInstrumentCount":0,"presetVersions":[],"families":[],"tempoBpm":120,"timeSignature":{"numerator":4,"denominator":4},"musicalKey":"c-minor"}'),repeat('e',64),gen_random_uuid(),statement_timestamp()-interval '2 days');
commit;`);
  return { actorId: actor.id, ids, slug, actorTitle, secondTitle, resultNote };
}

test.describe("challenge voting and permanent results", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("votes without totals, rejects self-vote, then exposes fixture-finalized results signed out", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const fixture = await prepareVotingJourney();
    await page.goto("/test-auth");
    await Promise.all([
      page.waitForURL(/\/onboarding$/),
      page.getByRole("button", { name: "Sign in test actor" }).click(),
    ]);
    await page.goto(`/challenges/${fixture.slug}`);
    await expect(
      page.getByRole("heading", { name: "Challenge entries" }),
    ).toBeVisible();
    await expect(page.getByText(fixture.actorTitle)).toBeVisible();
    await expect(page.getByText(fixture.secondTitle)).toBeVisible();
    await expect(page.getByText(/\d+ votes?/)).toHaveCount(0);

    const ownCard = page.locator("li").filter({ hasText: fixture.actorTitle });
    await ownCard.getByRole("button", { name: "Vote for this entry" }).click();
    await expect(ownCard.getByRole("alert")).toContainText(
      "cannot vote for your own entry",
    );

    const otherCard = page
      .locator("li")
      .filter({ hasText: fixture.secondTitle });
    await otherCard
      .getByRole("button", { name: "Vote for this entry" })
      .click();
    await expect(
      otherCard.getByRole("button", { name: "Your vote" }),
    ).toBeVisible();
    await expect(page.getByText(/\d+ votes?/)).toHaveCount(0);

    localSql(`begin;
alter table public.challenge_versions disable trigger challenge_versions_immutable;
update public.challenge_versions set voting_closes_at=statement_timestamp()-interval '1 second',results_expected_at=statement_timestamp()+interval '1 day' where id='${fixture.ids.version}';
alter table public.challenge_versions enable trigger challenge_versions_immutable;
set local role authenticated;
set local request.jwt.claim.sub='${fixture.actorId}';
select public.finalize_challenge_result('${fixture.ids.challenge}',gen_random_uuid(),2,'${fixture.ids.version}',null,'${fixture.resultNote}',
  '[{"entryId":"${fixture.ids.secondEntry}","place":1,"label":"Official winner"}]',null);
commit;`);

    const anonymous = await browser.newContext({
      baseURL: "http://localhost:3100",
    });
    const publicPage = await anonymous.newPage();
    await publicPage.goto(`/challenges/${fixture.slug}`);
    await expect(
      publicPage.getByRole("heading", { name: "Official results" }),
    ).toBeVisible();
    await expect(publicPage.getByText(fixture.resultNote)).toBeVisible();
    await expect(
      publicPage.getByRole("heading", { name: "Community Favorite" }),
    ).toBeVisible();
    await expect(publicPage.getByText(/1 vote/).first()).toBeVisible();
    await expect(
      publicPage.getByRole("button", { name: /vote for|your vote/i }),
    ).toHaveCount(0);
    await anonymous.close();
  });
});
