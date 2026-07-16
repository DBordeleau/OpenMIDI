import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
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

async function prepareActors() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing moderation E2E setup outside local Supabase.");
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const reporter = users.data.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!reporter) throw new Error("The local reporter actor is missing.");
  const targetEmail = "moderation-target@example.test";
  let target = users.data.users.find((user) => user.email === targetEmail);
  if (!target) {
    const created = await admin.auth.admin.createUser({
      email: targetEmail,
      password: "moderation-target-local-only",
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("Target actor was not created.");
    target = created.data.user;
  }
  prepareProfiles(reporter.id, target.id);
  return { reporterId: reporter.id, targetId: target.id };
}

function prepareProfiles(reporterId: string, targetId: string) {
  if (![reporterId, targetId].every((id) => /^[0-9a-f-]{36}$/.test(id)))
    throw new Error("Unsafe local actor identifier.");
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
      `update public.profiles set username='ModerationReporter',username_normalized='moderationreporter',display_name='Moderation Reporter',credit_name='Moderation Reporter',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible' where id='${reporterId}'; update public.profiles set username='ModerationTarget',username_normalized='moderationtarget',display_name='Moderation Target',credit_name='Moderation Target',profile_completed_at=statement_timestamp(),status='active',moderation_state='visible',moderation_version=1 where id='${targetId}';`,
    ],
    { encoding: "utf8" },
  );
}

function grantAdmin(reporterId: string) {
  if (!/^[0-9a-f-]{36}$/.test(reporterId))
    throw new Error("Unsafe reporter identifier.");
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
      `insert into private.app_admins(user_id,created_by) values('${reporterId}','${reporterId}') on conflict(user_id) do nothing`,
    ],
    { encoding: "utf8" },
  );
}

test.describe("moderation and restoration", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("report stays visible until an admin hides and restores it", async ({
    page,
    browser,
  }) => {
    test.setTimeout(60_000);
    const { reporterId } = await prepareActors();
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await page.goto("/@ModerationTarget");
    await expect(
      page.getByRole("heading", { name: "Moderation Target" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Report this profile" }).click();
    await page.getByLabel("What’s happening?").selectOption("harassment");
    await page
      .getByLabel("Optional context")
      .fill("Manual E2E report context.");
    await page.getByRole("button", { name: "Submit private report" }).click();
    await expect(page.getByText(/target remains visible/i)).toBeVisible();

    const anonymous = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
    const publicPage = await anonymous.newPage();
    await publicPage.goto("/@ModerationTarget");
    await expect(
      publicPage.getByRole("heading", { name: "Moderation Target" }),
    ).toBeVisible();

    grantAdmin(reporterId);
    await page.goto("/admin/moderation");
    await page.getByRole("link", { name: "@ModerationTarget" }).click();
    await page.waitForURL(/\/admin\/moderation\/[^/]+$/);
    const detailUrl = page.url();
    await page.getByLabel("Audit reason").fill("Confirmed manual test action.");
    await page.getByRole("button", { name: "Hide target" }).click();
    await expect(page.getByText("Action recorded.")).toBeVisible();
    const hiddenResponse = await publicPage.goto("/@ModerationTarget");
    expect(hiddenResponse?.status()).toBe(404);

    await page.goto(detailUrl);
    await page.getByLabel("Audit reason").fill("Restored after manual review.");
    await page.getByRole("button", { name: "Restore target" }).click();
    await publicPage.goto("/@ModerationTarget");
    await expect(
      publicPage.getByRole("heading", { name: "Moderation Target" }),
    ).toBeVisible();
    await anonymous.close();
  });
});
