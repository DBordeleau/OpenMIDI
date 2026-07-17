import "server-only";

export function getApplicationVersion() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (commit) return commit.slice(0, 12);
  return process.env.npm_package_version?.trim() || "0.0.0-local";
}
