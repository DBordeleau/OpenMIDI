import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const email = process.env.TEST_AUTH_EMAIL ?? "jam-session-e2e@example.test";
const password = process.env.TEST_AUTH_PASSWORD;
if (!password || password.length < 8)
  throw new Error(
    "Set TEST_AUTH_PASSWORD (8+ characters) for the local test actor.",
  );

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
const values = Object.fromEntries(
  output
    .split(/\r?\n/)
    .map((line) => line.match(/^([^=]+)="(.*)"$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const url = values.API_URL;
const serviceRoleKey = values.SERVICE_ROLE_KEY;
const publishableKey = values.PUBLISHABLE_KEY;
if (!url?.startsWith("http://127.0.0.1:") || !serviceRoleKey || !publishableKey)
  throw new Error(
    "Refusing test actor setup against a non-local or incomplete Supabase target.",
  );

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const rejectedEmail = `uninvited-${crypto.randomUUID()}@example.test`;
const rejected = await publicClient.auth.signUp({
  email: rejectedEmail,
  password,
});
if (!rejected.error) {
  if (rejected.data.user)
    await admin.auth.admin.deleteUser(rejected.data.user.id);
  throw new Error(
    "Before User Created hook accepted an uninvited local test actor.",
  );
}
const afterRejection = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (afterRejection.data.users.some((user) => user.email === rejectedEmail))
  throw new Error("Rejected test signup left an Auth user behind.");
const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const existing = data.users.find((user) => user.email === email);
const result = existing
  ? await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    })
  : await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (result.error) throw result.error;
console.log("Local E2E Auth actor is ready.");
