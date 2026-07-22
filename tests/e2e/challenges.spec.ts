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

async function prepareChallengeAdminAndStarter() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing challenge E2E setup outside local Supabase.");
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const actor = users.data.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!actor) throw new Error("Local challenge actor is missing.");
  const ownerEmail = "challenge-starter@example.test";
  let owner = users.data.users.find((user) => user.email === ownerEmail);
  if (!owner) {
    const created = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: "challenge-starter-local-only",
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("Starter owner not created.");
    owner = created.data.user;
  }
  const ids = {
    project: randomUUID(),
    arrangement: randomUUID(),
    revision: randomUUID(),
  };
  if (
    ![actor.id, owner.id, ...Object.values(ids)].every((value) =>
      /^[0-9a-f-]{36}$/.test(value),
    )
  )
    throw new Error("Unsafe challenge fixture identifier.");
  const starterTitle = `Reusable Starter ${Date.now()}`;
  const sql = `begin;
update public.profiles set username='ChallengeE2E',username_normalized='challengee2e',display_name='Challenge E2E',credit_name='Challenge E2E',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible' where id='${actor.id}';
update public.profiles set username='ChallengeStarter',username_normalized='challengestarter',display_name='Challenge Starter',credit_name='Challenge Starter',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible' where id='${owner.id}';
insert into private.app_admins(user_id,created_by) values('${actor.id}','${actor.id}') on conflict(user_id) do nothing;
insert into public.projects(id,owner_id,create_request_id,title,license_code) values('${ids.project}','${owner.id}',gen_random_uuid(),'${starterTitle}','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values('${ids.project}','${owner.id}','owner','${owner.id}');
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks) values('${ids.arrangement}','${ids.project}','${owner.id}',gen_random_uuid(),3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1','{}',repeat('a',64),120,4,4,'c-major',480,960);
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id) values('${ids.revision}','${ids.project}',1,'${owner.id}',gen_random_uuid(),'{}',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('b',64),1000,'${ids.arrangement}');
update public.projects set visibility='public',status='active',current_revision_id='${ids.revision}',published_at=statement_timestamp(),rights_attestation_version='cc-by-4.0-reuse-attestation-v1' where id='${ids.project}';
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
  return { starterTitle };
}

test.describe("curated challenge lifecycle", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );
  test("administrator creates and publishes, then a signed-out visitor opens the exact challenge", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const fixture = await prepareChallengeAdminAndStarter();
    const slug = `four-track-${Date.now()}`;
    const title = `Four Track Sprint ${Date.now()}`;
    await page.goto("/test-auth");
    await Promise.all([
      page.waitForURL(/\/onboarding$/),
      page.getByRole("button", { name: "Sign in test actor" }).click(),
    ]);
    await page.goto("/admin/challenges/new");
    await page.getByLabel("Canonical slug").fill(slug);
    await page.getByLabel("Challenge title").fill(title);
    await page
      .getByLabel("Creative prompt")
      .fill("Say more with exactly four parts.");
    await page
      .getByLabel("Description")
      .fill(
        "Build a focused arrangement whose limits leave room for personality.",
      );
    const starterSelect = page.getByLabel("Public project revision");
    await expect(starterSelect).toContainText(fixture.starterTitle);
    await starterSelect.selectOption(
      (await starterSelect.locator("option").nth(1).getAttribute("value"))!,
    );
    await page.getByRole("button", { name: "Create challenge draft" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Challenge draft created",
    );
    await page.getByRole("link", { name: "Open challenge" }).click();
    await page
      .getByRole("button", { name: "Publish immutable version" })
      .click();
    await expect(page.getByRole("status")).toContainText("Challenge published");

    const anonymous = await browser.newContext({
      baseURL: "http://localhost:3100",
    });
    const publicPage = await anonymous.newPage();
    await publicPage.goto(`/challenges/${slug}`);
    await expect(
      publicPage.getByRole("heading", { name: title }),
    ).toBeVisible();
    await expect(
      publicPage.getByText("Upcoming", { exact: true }),
    ).toBeVisible();
    await expect(publicPage.getByText("Use 4 tracks.")).toBeVisible();
    await expect(publicPage.getByText("Challenge E2E")).toBeVisible();
    await expect(publicPage.getByText(fixture.starterTitle)).toBeVisible();
    // The presentation code only retints the hero — it must never draw the
    // coloured left bar the design brief removed.
    const presentation = publicPage.locator("article.challenge-pulse");
    await expect(presentation).toHaveCSS("border-left-width", "0px");
    await expect(publicPage.locator(".challenge-hero")).not.toHaveCSS(
      "background-image",
      "none",
    );
    // A site-issued challenge is not reportable user content.
    await expect(publicPage.getByText("Report this challenge")).toHaveCount(0);
    await expect(
      publicPage.getByText(/Submissions open in \d+ (day|hour|minute)/),
    ).toBeVisible();
    await expect(
      publicPage.getByRole("heading", { name: "Frozen schedule" }),
    ).toBeVisible();
    await expect(
      publicPage.getByRole("button", { name: /submit|vote/i }),
    ).toHaveCount(0);
    await anonymous.close();
  });
});
