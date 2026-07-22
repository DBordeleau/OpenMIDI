import { expect, test as base } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const actorProfile = {
  username: "AvatarE2E",
  displayName: "Avatar E2E",
} as const;

function localSupabaseEnv() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http://127.0.0.1:") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return {
      API_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
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

async function seedCompletedAvatarActor() {
  const env = localSupabaseEnv();
  if (
    !env.API_URL?.startsWith("http://127.0.0.1:") ||
    !env.SERVICE_ROLE_KEY ||
    !process.env.TEST_AUTH_EMAIL
  )
    throw new Error("Refusing E2E avatar fixture outside local Supabase.");
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
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
      `update public.profiles set username='${actorProfile.username}',username_normalized=lower('${actorProfile.username}'),display_name='${actorProfile.displayName}',credit_name='${actorProfile.displayName}',bio=null,profile_completed_at=statement_timestamp(),status='active',moderation_state='visible',purged_at=null,avatar_config=null,avatar_config_revision=0,avatar_updated_at=null where id='${actor.id}'`,
    ],
    { encoding: "utf8" },
  );
}

const test = base.extend<{ completedAvatarActor: typeof actorProfile }>({
  completedAvatarActor: async ({ page }, provide) => {
    void page;
    await seedCompletedAvatarActor();
    await provide(actorProfile);
  },
});

test.describe("generated avatar settings", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test("saves, displays, and resets locally without avatar egress", async ({
    page,
    completedAvatarActor,
  }) => {
    const avatarEgress: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (
        /dicebear/i.test(url) ||
        url.includes("/storage/v1/") ||
        url.includes("/functions/v1/") ||
        url.includes("process-profile-image") ||
        url.includes("/api/profile-image")
      )
        avatarEgress.push(url);
    });

    await page.goto("/test-auth");
    await page.getByRole("button", { name: "Sign in test actor" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/settings/avatar");
    await expect(
      page.getByRole("heading", { name: "Build your avatar" }),
    ).toBeVisible();

    await page.getByRole("radio", { name: "Eyebrows 2" }).click();
    await page.getByRole("radio", { name: "Lavender #f8e4f8" }).click();
    const previewFingerprint = await page
      .getByAltText(`${completedAvatarActor.displayName}'s avatar preview`)
      .getAttribute("data-avatar-fingerprint");
    if (!previewFingerprint)
      throw new Error("Avatar preview omitted its deterministic fingerprint.");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText("Avatar saved across your profile."),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator("img[data-avatar-fingerprint]")
          .evaluateAll((images) =>
            images.map((image) =>
              image.getAttribute("data-avatar-fingerprint"),
            ),
          ),
      )
      .toContain(previewFingerprint);

    await page.goto(`/@${completedAvatarActor.username}`);
    await page.reload();
    await expect
      .poll(() =>
        page
          .locator("img[data-avatar-fingerprint]")
          .evaluateAll((images) =>
            images.map((image) =>
              image.getAttribute("data-avatar-fingerprint"),
            ),
          ),
      )
      .toContain(previewFingerprint);

    await page.goto("/settings/avatar");
    await page.getByRole("button", { name: "Reset to initials" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "Reset to initials?",
    });
    await dialog.getByRole("button", { name: "Reset avatar" }).click();
    await expect(page.getByText("Avatar reset to initials.")).toBeVisible();
    await expect(
      page.getByLabel(`${completedAvatarActor.displayName}'s initials`).first(),
    ).toBeVisible();
    expect(avatarEgress).toEqual([]);
  });
});
