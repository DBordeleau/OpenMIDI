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

async function prepareEntryJourney() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  ) {
    throw new Error(
      "Refusing challenge entry E2E setup outside local Supabase.",
    );
  }
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const actor = users.data.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!actor) throw new Error("Local challenge entry actor is missing.");
  const id = () => randomUUID();
  const ids = {
    eligibleProject: id(),
    ineligibleProject: id(),
    eligibleArrangement: id(),
    ineligibleArrangement: id(),
    eligibleRevision: id(),
    ineligibleRevision: id(),
    challenge: id(),
    version: id(),
    eligibleTrackA: id(),
    eligibleTrackB: id(),
    ineligibleTrack: id(),
  };
  if (
    ![actor.id, ...Object.values(ids)].every((value) =>
      /^[0-9a-f-]{36}$/.test(value),
    )
  ) {
    throw new Error("Unsafe challenge entry fixture identifier.");
  }
  const slug = `entry-preflight-${Date.now()}`;
  const eligibleTitle = `Eligible Entry ${Date.now()}`;
  const ineligibleTitle = `Needs Work ${Date.now()}`;
  const sql = `begin;
update public.profiles set username='ChallengeEntrant',username_normalized='challengeentrant',display_name='Challenge Entrant',credit_name='Challenge Entrant',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible' where id='${actor.id}';
insert into public.projects(id,owner_id,create_request_id,title,license_code) values
('${ids.eligibleProject}','${actor.id}',gen_random_uuid(),'${eligibleTitle}','cc-by-4.0'),
('${ids.ineligibleProject}','${actor.id}',gen_random_uuid(),'${ineligibleTitle}','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values
('${ids.eligibleProject}','${actor.id}','owner','${actor.id}'),('${ids.ineligibleProject}','${actor.id}','owner','${actor.id}');
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks) values
('${ids.eligibleArrangement}','${ids.eligibleProject}','${actor.id}',gen_random_uuid(),3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1','{}',repeat('a',64),100,4,4,'c-minor',480,1920),
('${ids.ineligibleArrangement}','${ids.ineligibleProject}','${actor.id}',gen_random_uuid(),3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1','{}',repeat('b',64),120,3,4,null,480,1920);
insert into public.arrangement_tracks(arrangement_version_id,project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed) values
('${ids.eligibleArrangement}','${ids.eligibleProject}','${ids.eligibleTrackA}',0,'Keys','warm-keys',1,0,0,false,false),
('${ids.eligibleArrangement}','${ids.eligibleProject}','${ids.eligibleTrackB}',1,'Bass','analog-bass',1,0,0,true,false),
('${ids.ineligibleArrangement}','${ids.ineligibleProject}','${ids.ineligibleTrack}',0,'Lead','saw-lead',1,0,0,false,false);
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id) values
('${ids.eligibleRevision}','${ids.eligibleProject}',1,'${actor.id}',gen_random_uuid(),'Ready for the constraint','{}',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('c',64),2000,'${ids.eligibleArrangement}'),
('${ids.ineligibleRevision}','${ids.ineligibleProject}',1,'${actor.id}',gen_random_uuid(),'First sketch','{}',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('d',64),2000,'${ids.ineligibleArrangement}');
update public.projects set status='active',visibility='private',current_revision_id='${ids.eligibleRevision}',published_at=statement_timestamp() where id='${ids.eligibleProject}';
update public.projects set status='active',visibility='private',current_revision_id='${ids.ineligibleRevision}',published_at=statement_timestamp() where id='${ids.ineligibleProject}';
insert into public.challenges(id,slug,created_by,state,published_at) values('${ids.challenge}','${slug}','${actor.id}','published',statement_timestamp());
insert into public.challenge_versions(id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,eligibility_terms,presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,judging_mode,official_placement_count,constraints,constraints_sha256) values
('${ids.version}','${ids.challenge}',1,'${actor.id}',gen_random_uuid(),'Two Part Entry Test','Make two parts carry the whole idea.','Meet every structural boundary before submitting.','Only work you are authorized to display in this challenge.','pulse',statement_timestamp()-interval '1 day',statement_timestamp()+interval '1 day',statement_timestamp()+interval '2 days',statement_timestamp()+interval '3 days',statement_timestamp()+interval '4 days','community',0,
private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":2},"distinctInstrumentCount":{"exact":2},"instruments":{"allowedPresetVersions":[],"requiredPresetVersions":[],"allowedFamilies":["keys","basses"],"requiredFamilies":["basses"]},"tempoBpm":{"exact":100},"timeSignature":{"numerator":4,"denominator":4},"musicalKey":"c-minor"}'),repeat('e',64));
update public.challenges set current_version_id='${ids.version}' where id='${ids.challenge}';
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
  return { slug, eligibleTitle, ineligibleTitle };
}

test.describe("challenge exact entry preflight", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("shows every failure, then submits one eligible exact revision with explicit display consent", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const fixture = await prepareEntryJourney();
    await page.goto("/test-auth");
    await Promise.all([
      page.waitForURL(/\/onboarding$/),
      page.getByRole("button", { name: "Sign in test actor" }).click(),
    ]);
    await page.goto(`/challenges/${fixture.slug}`);
    const revision = page.getByLabel("Current immutable project revision");
    await revision.selectOption({
      label: `${fixture.ineligibleTitle} · revision 1 · private`,
    });
    await page
      .getByRole("button", { name: "Run eligibility preflight" })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "not eligible yet" }),
    ).toBeVisible();
    await expect(page.getByText(/Needs change ·/)).toHaveCount(7);
    await expect(
      page.getByRole("link", { name: "Correct in Studio" }),
    ).toHaveAttribute("href", /\/studio\//);

    await revision.selectOption({
      label: `${fixture.eligibleTitle} · revision 1 · private`,
    });
    await page
      .getByRole("button", { name: "Run eligibility preflight" })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "passes every challenge rule" }),
    ).toBeVisible();
    await expect(page.getByText(/Pass ·/)).toHaveCount(7);
    await page
      .getByRole("checkbox", {
        name: /authorize challenge-scoped public display/i,
      })
      .check();
    await page
      .getByRole("button", { name: "Submit this exact revision" })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Entry submitted" }),
    ).toBeVisible();
    await expect(page.getByText("My entry · revision 1")).toBeVisible();
    await expect(
      page.getByText(/does not make my project generally public/i),
    ).toBeVisible();
  });
});
