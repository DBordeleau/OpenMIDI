import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const execute = process.argv.includes("--execute");
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : execute ? 100 : 500;
if (!Number.isInteger(limit) || limit < 1 || limit > (execute ? 100 : 500))
  throw new Error("Use a positive --limit within the operator bound.");

function localEnvironment() {
  const raw =
    process.platform === "win32"
      ? execFileSync(
          process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe",
          ["/d", "/s", "/c", "npm exec supabase -- status -o env"],
          { encoding: "utf8", windowsHide: true },
        )
      : execFileSync("npm", ["exec", "supabase", "--", "status", "-o", "env"], {
          encoding: "utf8",
        });
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)="?(.*?)"?$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  const local = localEnvironment();
  url = local.API_URL;
  key = local.SERVICE_ROLE_KEY;
}
if (!url || !key)
  throw new Error("A Supabase URL and service-role key are required.");
const host = new URL(url).host;
const isLocal = ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
console.log(`Retention target: ${host} (${isLocal ? "local" : "remote"}).`);
if (execute && !isLocal) {
  const expected = process.argv
    .find((value) => value.startsWith("--confirm-host="))
    ?.split("=")[1];
  if (expected !== host)
    throw new Error(
      `Remote execution requires --confirm-host=${host}. Run preview and review it first.`,
    );
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const preview = await db.rpc("operator_retention_preview", { p_limit: limit });
if (preview.error)
  throw new Error(`Retention preview failed: ${preview.error.code}`);
console.log(JSON.stringify(preview.data, null, 2));
if (!execute) process.exit(0);

const started = await db.rpc("operator_start_retention_run", {
  p_limit: limit,
});
if (started.error || !started.data)
  throw new Error(
    `Retention run could not start: ${started.error?.code ?? "missing_run"}`,
  );
const runId = started.data;
let processed = 0;
while (processed < limit) {
  const claimed = await db.rpc("operator_claim_retention_job", {
    p_run_id: runId,
  });
  if (claimed.error)
    throw new Error(`Retention claim failed: ${claimed.error.code}`);
  const claim = claimed.data;
  if (!claim) break;
  const finalized = await db.rpc("operator_finalize_retention_job", {
    p_job_id: claim.jobId,
    p_lease_token: claim.leaseToken,
    p_deleted_object_ids: [],
    p_missing_object_ids: [],
  });
  if (finalized.error)
    throw new Error(`Retention finalization failed: ${finalized.error.code}`);
  processed += 1;
}
const completed = await db.rpc("operator_complete_retention_run", {
  p_run_id: runId,
});
if (completed.error)
  throw new Error(`Retention run completion failed: ${completed.error.code}`);
console.log(JSON.stringify(completed.data, null, 2));
