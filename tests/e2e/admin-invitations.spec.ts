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

async function prepareViewer() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing invitation E2E setup outside local Supabase.");
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const viewer = users.data.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!viewer) throw new Error("The local invitation actor is missing.");
  updateViewer(viewer.id, false);
  return viewer.id;
}

function updateViewer(viewerId: string, isAdmin: boolean) {
  if (!/^[0-9a-f-]{36}$/.test(viewerId))
    throw new Error("Unsafe local invitation actor identifier.");
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
      `update public.profiles set username='InviteE2E',username_normalized='invitee2e',display_name='Invite E2E',credit_name='Invite E2E',profile_completed_at=statement_timestamp(),status='active' where id='${viewerId}'; ${adminSql}`,
    ],
    { encoding: "utf8" },
  );
}

function verifyInvitation(normalizedEmail: string) {
  if (!/^[a-z0-9-]+@example\.test$/.test(normalizedEmail))
    throw new Error("Unsafe synthetic invitation address.");
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
      "-tAc",
      `select count(*)::text || ':' || (private.hook_require_signup_invitation(jsonb_build_object('user',jsonb_build_object('email','${normalizedEmail}'))) = '{}'::jsonb)::text from private.signup_invitations where email_normalized='${normalizedEmail}' and revoked_at is null;`,
    ],
    { encoding: "utf8" },
  ).trim();
}

test.describe("administrator beta invitations", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("hides the control from a member and activates access for an administrator", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const viewerId = await prepareViewer();
    await page.goto("/test-auth");
    await Promise.all([
      page.waitForURL(/\/onboarding$/),
      page.getByRole("button", { name: "Sign in test actor" }).click(),
    ]);
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Invite a collaborator" }),
    ).toHaveCount(0);

    updateViewer(viewerId, true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Invite a collaborator" }),
    ).toBeVisible();

    const unique = `admin-${Date.now()}`;
    const submittedEmail = `${unique}@Example.Test`;
    const normalizedEmail = `${unique}@example.test`;
    await page.getByLabel("Collaborator email").fill(submittedEmail);
    await page.getByRole("button", { name: "Add to beta" }).click();
    await expect(page.getByRole("status")).toContainText(
      `${normalizedEmail} can now sign in with Google`,
    );
    expect(verifyInvitation(normalizedEmail)).toBe("1:true");
  });
});
