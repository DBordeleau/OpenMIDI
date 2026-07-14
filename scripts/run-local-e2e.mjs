import { execFileSync, spawnSync } from "node:child_process";

let output;
try {
  output =
    process.platform === "win32"
      ? execFileSync(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", "npx supabase status -o env"],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
        )
      : execFileSync("npx", ["supabase", "status", "-o", "env"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
} catch {
  failPreflight("The local Supabase stack is not running.");
}

const local = Object.fromEntries(
  output
    .split(/\r?\n/)
    .map((line) => line.match(/^([^=]+)="(.*)"$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
if (
  !local.API_URL?.startsWith("http://127.0.0.1:") ||
  !local.PUBLISHABLE_KEY ||
  !local.SERVICE_ROLE_KEY
)
  failPreflight("The local Supabase status is incomplete or unsafe.");
try {
  const storage = await fetch(`${local.API_URL}/storage/v1/bucket`, {
    headers: {
      apikey: local.SERVICE_ROLE_KEY,
      authorization: `Bearer ${local.SERVICE_ROLE_KEY}`,
    },
  });
  if (!storage.ok) throw new Error(String(storage.status));
} catch {
  failPreflight("The local Storage API is not reachable.");
}

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  ENABLE_TEST_AUTH: "true",
  LOCAL_E2E: "true",
  TEST_AUTH_EMAIL:
    process.env.TEST_AUTH_EMAIL ?? "jam-session-e2e@example.test",
  TEST_AUTH_PASSWORD:
    process.env.TEST_AUTH_PASSWORD ?? "jam-session-local-e2e-only",
};

run(process.execPath, ["scripts/setup-auth-e2e.mjs"], env);
run(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  env,
);

function run(command, args, childEnv) {
  const result = spawnSync(command, args, { env: childEnv, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function failPreflight(reason) {
  console.error(`Local E2E preflight failed: ${reason}`);
  console.error("Run these commands, then retry:");
  console.error("  npm run supabase:start:storage");
  console.error("  npm run db:reset");
  process.exit(1);
}
