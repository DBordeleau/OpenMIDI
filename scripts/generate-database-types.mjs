import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const usage = "Usage: node scripts/generate-database-types.mjs --write|--check";
const mode = process.argv[2];

if (process.argv.length !== 3 || !["--write", "--check"].includes(mode)) {
  console.error(usage);
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "src/lib/supabase/database.types.ts");
const cliEntry = resolve(root, "node_modules/supabase/dist/supabase.js");

try {
  await access(cliEntry, constants.R_OK);
} catch {
  console.error(
    "The repository-local Supabase CLI is unavailable. Run npm ci first.",
  );
  process.exit(1);
}

function generateTypes() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [cliEntry, "gen", "types", "typescript", "--local", "--schema", "public"],
      { cwd: root, windowsHide: true },
    );
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString("utf8").trim();
        reject(
          new Error(
            detail || `Supabase type generation exited with code ${code}.`,
          ),
        );
        return;
      }

      const generated = Buffer.concat(stdout)
        .toString("utf8")
        .replace(/\r?\n?$/, "\n");
      if (generated.trim().length === 0) {
        reject(new Error("Supabase type generation returned empty output."));
        return;
      }
      resolvePromise(generated);
    });
  });
}

try {
  const generated = await generateTypes();

  if (mode === "--check") {
    let tracked;
    try {
      tracked = await readFile(target, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      tracked = "";
    }

    if (tracked !== generated) {
      console.error(
        "Generated database types are stale. Run npm run db:types.",
      );
      process.exit(1);
    }
    console.log("Generated database types are current.");
  } else {
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, generated, { encoding: "utf8", flag: "wx" });
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
    console.log("Generated database types updated.");
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Database type generation failed.",
  );
  process.exit(1);
}
