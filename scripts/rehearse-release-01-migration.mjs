import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const supabaseCli = resolve(root, "node_modules/supabase/dist/supabase.js");
const populatedState = "rehearsals/release-01-populated-state.sql";
const verificationSql = readFileSync(
  resolve(root, "supabase/rehearsals/release-01-verify.sql"),
  "utf8",
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio:
      options.input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
    windowsHide: true,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}.`);
  }
}

function runSupabase(args) {
  run(process.execPath, [supabaseCli, ...args]);
}

let rehearsalError;
try {
  runSupabase([
    "db",
    "reset",
    "--version",
    "20260718222256",
    "--sql-paths",
    "seed.sql",
    "--sql-paths",
    populatedState,
  ]);
  runSupabase(["migration", "up", "--local"]);
  run(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_openmidi",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: verificationSql },
  );
  console.log("RELEASE-01 populated-state reconciliation rehearsal passed.");
} catch (error) {
  rehearsalError = error;
} finally {
  try {
    runSupabase(["db", "reset"]);
  } catch (error) {
    rehearsalError ??= error;
  }
}

if (rehearsalError) throw rehearsalError;
