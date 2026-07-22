import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function localSupabaseEnv() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http://127.0.0.1:") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return {
      API_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    };
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
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2]]),
  );
}

async function resetTestActorProfile() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing E2E profile reset outside local Supabase.");
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;
  const actor = users.users.find(
    (user) => user.email === process.env.TEST_AUTH_EMAIL,
  );
  if (!actor)
    throw new Error("Local E2E actor setup did not create the actor.");
  if (!/^[0-9a-f-]{36}$/.test(actor.id))
    throw new Error("Local E2E actor has an invalid identifier.");
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
      `update public.profiles set username=null, username_normalized=null, display_name=null, credit_name=null, bio=null, profile_completed_at=null where id='${actor.id}'`,
    ],
    { encoding: "utf8" },
  );
}

test.describe("identity vertical slice", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("onboards, creates a MIDI project, edits the profile, and signs out", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await resetTestActorProfile();
    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(
      page.getByRole("heading", { name: "Create your public profile" }),
    ).toBeVisible();

    await page.getByLabel("Username").fill("E2EArtist");
    await page.getByLabel("Display name").fill("E2E Artist");
    await page.getByLabel("Credit name").fill("E2E Credit");
    await page.getByLabel("Bio").fill("A safe public test biography.");
    await page.getByRole("button", { name: "Complete profile" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);

    // Project destinations now live behind the header's avatar account menu.
    const accountTrigger = page.getByRole("button", { name: "Account menu" });
    await accountTrigger.click();
    const accountPanelId = await accountTrigger.getAttribute("aria-controls");
    if (!accountPanelId) throw new Error("Account menu panel did not open.");
    await page
      .locator(`[id="${accountPanelId}"]`)
      .getByRole("link", { name: "My projects" })
      .click();
    await page.getByRole("link", { name: "New project" }).first().click();
    await page.getByLabel("Title").fill("E2E collaboration draft");
    await page.getByLabel("Description").fill("A private project test.");
    await page.getByLabel("BPM").fill("118.5");
    await page.getByLabel("Musical key").selectOption("d-minor");
    await page.getByLabel("Electronic", { exact: true }).check();
    await page.getByLabel("Electronic as primary genre").check();
    await page.getByLabel("Collaboration wanted", { exact: true }).check();
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(
      page.getByRole("button", {
        name: /Project menu.*E2E collaboration draft/,
      }),
    ).toBeVisible({ timeout: 15_000 });
    const studioUrl = new URL(page.url()).pathname;
    const projectId = studioUrl.split("/").at(-1);
    if (!projectId) throw new Error("Project creation omitted its identifier.");
    const projectUrl = `/projects/${projectId}`;
    await page.goto(projectUrl);
    await expect(page.getByText("118.5 BPM")).toBeVisible();
    await page.getByRole("link", { name: "Edit metadata" }).click();
    await page.getByLabel("Title").fill("Edited collaboration draft");
    await page.getByRole("button", { name: "Save project" }).click();
    await expect(page.getByText("Project saved.")).toBeVisible();

    await page.goto("/@E2EArtist");
    await expect(
      page.getByRole("heading", { name: "E2E Artist" }),
    ).toBeVisible();
    await expect(page.getByText("A safe public test biography.")).toBeVisible();

    await page.goto("/settings/profile");
    await page.getByLabel("Display name").fill("Edited Artist");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  });
});

test("test Auth route is absent when disabled", async ({ page }) => {
  test.skip(process.env.ENABLE_TEST_AUTH === "true", "enabled local test run");
  const response = await page.goto("/test-auth");
  expect(response?.status()).toBe(404);
});
