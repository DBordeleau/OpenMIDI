import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const firstWord = ["ja", "m"].join("");
const secondWord = ["ses", "sion"].join("");
const forbiddenIdentity = new RegExp(`${firstWord}[\\s_-]*${secondWord}`, "iu");

export function hasFormerIdentity(source) {
  return forbiddenIdentity.test(source);
}

function repositoryFiles(root) {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root },
  ).toString("utf8");

  return output.split("\0").filter(Boolean);
}

function readTrackedText(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) return null;
  const bytes = readFileSync(absolutePath);

  // NUL bytes and invalid UTF-8 identify binary material that cannot contain
  // project-owned textual identity. No textual path or content allowlist exists.
  if (bytes.includes(0)) return null;

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function findIdentityViolations(root = process.cwd()) {
  const violations = [];

  for (const relativePath of repositoryFiles(root)) {
    const source = readTrackedText(root, relativePath);
    if (source !== null && hasFormerIdentity(source)) {
      violations.push(relativePath);
    }
  }

  return violations;
}

function main() {
  const violations = findIdentityViolations();
  if (violations.length > 0) {
    console.error("OpenMIDI identity contract violations:");
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log("OpenMIDI identity contract passed.");
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) main();
