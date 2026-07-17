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
});
