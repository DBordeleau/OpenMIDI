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

async function prepareFeedbackActor() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  ) {
    throw new Error("Refusing feedback E2E setup outside local Supabase.");
  }
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const viewer = users.data.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!viewer) throw new Error("The local feedback actor is missing.");
  setViewerState(viewer.id, false);
  return viewer.id;
}

function setViewerState(viewerId: string, isAdmin: boolean) {
  if (!/^[0-9a-f-]{36}$/.test(viewerId))
    throw new Error("Unsafe local feedback actor identifier.");
  const adminSql = isAdmin
    ? `insert into private.app_admins(user_id,created_by) values('${viewerId}','${viewerId}') on conflict(user_id) do nothing;`
    : `delete from private.app_admins where user_id='${viewerId}';`;
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
      `update public.profiles set username='FeedbackE2E',username_normalized='feedbacke2e',display_name='Feedback E2E',credit_name='Feedback E2E',profile_completed_at=statement_timestamp(),status='active' where id='${viewerId}'; ${adminSql}`,
    ],
    { encoding: "utf8" },
  );
}

test.describe("beta feedback intake and triage", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("submits disclosed context and lets an administrator mark it handled", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const viewerId = await prepareFeedbackActor();
    await page.goto("/test-auth");
    await Promise.all([
      page.waitForURL(/\/onboarding$/),
      page.getByRole("button", { name: "Sign in test actor" }).click(),
    ]);
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Send feedback" }).click();

    await expect(
      page.getByRole("heading", { name: "Help tune the next session" }),
    ).toBeVisible();
    await expect(page.getByText("/dashboard", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: /Report a bug/i }).check();
    const summary = `Playback timing drifts ${Date.now()}`;
    await page.getByRole("textbox", { name: "Summary" }).fill(summary);
    await page
      .getByRole("textbox", { name: "Details" })
      .fill("Playback drifts after the first measure when the loop restarts.");
    await page
      .getByRole("checkbox", { name: /Share browser and platform context/i })
      .check();
    await expect(
      page.getByRole("textbox", {
        name: "Browser/platform text that will be sent",
      }),
    ).not.toHaveValue("");
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByRole("status")).toContainText(/FB-[A-F0-9]+/);

    setViewerState(viewerId, true);
    await page.goto("/admin/feedback");
    await page.getByRole("link", { name: summary }).click();
    await expect(page.getByText("Private administrator detail")).toBeVisible();
    await page
      .getByLabel("Private note")
      .fill("Verified in the focused Chromium feedback journey.");
    await page.getByRole("button", { name: "Mark handled" }).click();
    await expect(page.getByRole("status")).toContainText("Feedback updated.");
    await expect(page.getByText("handled", { exact: true })).toBeVisible();
  });
});
