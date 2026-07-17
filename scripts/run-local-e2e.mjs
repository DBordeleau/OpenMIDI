import { execFile, execFileSync, spawn } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const baseUrl = "http://127.0.0.1:3100";
const children = new Set();
let interrupted = false;

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
if (await isReachable(baseUrl))
  failPreflight(
    "Port 3100 is already serving another process. Stop that process before local E2E.",
  );

const e2eLock = path.join(process.cwd(), ".next-e2e", "dev", "lock");
if (existsSync(e2eLock)) unlinkSync(e2eLock);

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  ENABLE_TEST_AUTH: "true",
  LOCAL_E2E: "true",
  E2E_EXTERNAL_SERVER: "true",
  NEXT_DIST_DIR: ".next-e2e",
  TEST_AUTH_EMAIL:
    process.env.TEST_AUTH_EMAIL ?? "jam-session-e2e@example.test",
  TEST_AUTH_PASSWORD:
    process.env.TEST_AUTH_PASSWORD ?? "jam-session-local-e2e-only",
};

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void interrupt(signal);
  });
}

let server;
try {
  const setupCode = await run(
    process.execPath,
    ["scripts/setup-auth-e2e.mjs"],
    env,
  );
  if (setupCode !== 0)
    throw new Error(`Local E2E Auth setup exited with ${setupCode}.`);
  server = start(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--port", "3100"],
    env,
  );
  await waitForServer(server, baseUrl);
  process.exitCode = await run(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      ...(process.argv.length > 2
        ? process.argv.slice(2)
        : [
            "tests/e2e/identity.spec.ts",
            "tests/e2e/studio-startup.spec.ts",
            "tests/e2e/collaboration-v3.spec.ts",
          ]),
    ],
    env,
  );
} finally {
  if (server) await stopProcessTree(server);
}

function start(command, args, childEnv) {
  const child = spawn(command, args, {
    env: childEnv,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  children.add(child);
  child.once("close", () => children.delete(child));
  return child;
}

function run(command, args, childEnv) {
  return new Promise((resolve, reject) => {
    const child = start(command, args, childEnv);
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
}

async function waitForServer(child, url) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        `The local E2E Next.js server exited with ${child.exitCode}.`,
      );
    if (await isReachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The local E2E Next.js server did not become ready in 120s.");
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
    return response.status > 0;
  } catch {
    return false;
  }
}

async function interrupt(signal) {
  if (interrupted) return;
  interrupted = true;
  await Promise.all([...children].map(stopProcessTree));
  process.exit(signal === "SIGINT" ? 130 : 143);
}

function stopProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return Promise.resolve();
  if (process.platform === "win32")
    return new Promise((resolve) => {
      execFile(
        "taskkill",
        ["/PID", String(child.pid), "/T", "/F"],
        { windowsHide: true },
        () => resolve(),
      );
    });
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    // The process exited between the status check and signal.
  }
  return Promise.resolve();
}

function failPreflight(reason) {
  console.error(`Local E2E preflight failed: ${reason}`);
  console.error("Run these commands, then retry:");
  console.error("  npm run supabase:start:auth");
  console.error("  npm run db:reset");
  process.exit(1);
}
