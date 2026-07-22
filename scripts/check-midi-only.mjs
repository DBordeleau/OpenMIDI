import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations = [];

function filesUnder(relativePath, extensions) {
  const absolute = path.join(root, relativePath);
  try {
    if (!statSync(absolute).isDirectory()) return [relativePath];
  } catch {
    return [];
  }
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) return filesUnder(child, extensions);
    return extensions.some((extension) => entry.name.endsWith(extension))
      ? [child]
      : [];
  });
}

function check(files, patterns) {
  for (const file of files) {
    const source = readFileSync(path.join(root, file), "utf8");
    for (const [label, pattern] of patterns) {
      if (pattern.test(source)) violations.push(`${file}: ${label}`);
    }
  }
}

const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);
for (const dependency of [
  "@waveform-playlist/browser",
  "@waveform-playlist/engine",
  "@waveform-playlist/playout",
]) {
  if (
    dependency in (packageJson.dependencies ?? {}) ||
    dependency in (packageJson.devDependencies ?? {})
  ) {
    violations.push(`package.json: forbidden dependency ${dependency}`);
  }
}

for (const script of [
  "avatars:process",
  "avatars:cleanup",
  "avatars:cleanup:execute",
  "supabase:start:storage",
]) {
  if (script in (packageJson.scripts ?? {})) {
    violations.push(`package.json: forbidden retired avatar script ${script}`);
  }
}

for (const retiredPath of [
  "scripts/recover-profile-images.mjs",
  "supabase/functions/process-profile-image",
  "supabase/functions/_shared/profile-image.ts",
]) {
  if (filesUnder(retiredPath, [".mjs", ".ts", ".json"]).length > 0) {
    violations.push(`${retiredPath}: retired avatar worker path exists`);
  }
}

const avatarMigrationAllowlist = new Set([
  "supabase/migrations/20260717000001_foundation_identity.sql",
  "supabase/migrations/20260717000004_moderation_avatar_operations.sql",
  "supabase/migrations/20260722174831_avatar_01_generated_avatar_contract.sql",
  "supabase/migrations/20260722194242_avatar_03_retire_legacy_avatar_storage.sql",
]);
check(
  filesUnder("supabase/migrations", [".sql"]).filter(
    (file) => !avatarMigrationAllowlist.has(file.replaceAll("\\", "/")),
  ),
  [
    [
      "retired avatar upload/storage contract",
      /profile[_-]?image|profile-images|public-avatars|avatar[_-]?cleanup|avatar_path|avatar_version_id/i,
    ],
  ],
);

check(filesUnder("supabase/migrations", [".sql"]), [
  [
    "legacy audio/storage schema",
    /source[_-]?audio|waveform|workspace-snapshots|derived-assets/i,
  ],
  ["pre-pivot stem schema", /midi_stem|midi stems?/i],
  ["legacy runtime", /waveform-playlist|openmidi-composite/i],
  [
    "network/cron worker infrastructure",
    /create extension[^;]*(?:pg_net|pg_cron)|\b(?:net|cron)\./i,
  ],
  ["Storage-backed musical snapshot", /snapshot_asset_id/i],
]);

check(
  [
    ...filesUnder("src/app", [".ts", ".tsx"]),
    ...filesUnder("src/server", [".ts", ".tsx"]),
    ...filesUnder("src/features", [".ts", ".tsx"]),
  ],
  [
    [
      "source-audio application contract",
      /source[ _-]?audio|source asset upload|waveform peak/i,
    ],
    ["Storage-backed musical snapshot", /snapshot_asset_id/i],
    ["legacy editor dependency", /@waveform-playlist\//i],
  ],
);

const currentDocs = [
  ".env.example",
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "docs/PRD.md",
  "docs/ROADMAP.md",
  "docs/design/brand.md",
  "docs/technical-design/README.md",
  "docs/technical-design/01-system-architecture.md",
  "docs/technical-design/02-data-model.md",
  "docs/technical-design/03-delivery-plan.md",
  "docs/technical-design/decisions/README.md",
  "docs/runbooks/beta-operations.md",
  "docs/runbooks/moderation-retention.md",
];
check(currentDocs, [
  [
    "obsolete audio environment secret",
    /AUDIO_|ASSET_VERIFICATION_|SOURCE_ADMISSION_/i,
  ],
  [
    "obsolete audio command",
    /npm run (?:assets:verify|test:e2e:upload)|supabase functions deploy/i,
  ],
  [
    "obsolete musical Storage bucket",
    /(?:source-audio|workspace-snapshots|derived-assets) bucket/i,
  ],
  [
    "obsolete audio worker/cron instruction",
    /deploy .*verification|schedule .*verification|verification cron/i,
  ],
  [
    "retired avatar upload/storage documentation",
    /profile-images|public-avatars|supabase:start:storage|avatars:process|avatars:cleanup|process-profile-image|PROFILE_IMAGE_RECOVERY_SECRET/i,
  ],
  ["remote DiceBear renderer", /https?:\/\/(?:api\.)?dicebear\.com/i],
]);

check(
  ["README.md"],
  [
    [
      "deleted Studio audio runtime described as current behavior",
      /Waveform Playlist|private source assets|original stems|while audio loads|source-admission denial/i,
    ],
    [
      "stale hosted-development authority",
      /Normal interactive development remains pointed at hosted Supabase/i,
    ],
  ],
);

check(
  ["docs/design/brand.md"],
  [
    [
      "deleted Studio adapter in current brand guidance",
      /waveform-playlist-adapter|studio-surface\.tsx|transitional manifest-v2|legacy manifest-v1/i,
    ],
    [
      "deleted landing hero component",
      /hero-waveform\.client\.tsx|HeroWaveform/,
    ],
  ],
);

check(filesUnder("supabase/functions", [".ts", ".js", ".sql", ".json"]), [
  [
    "audio Edge Function",
    /source[_-]?audio|waveform|asset verification|audio bucket/i,
  ],
  [
    "avatar image-processing worker",
    /profile[_-]?image|profile-images|public-avatars|process-profile-image/i,
  ],
]);

check(
  [
    ...filesUnder("src/app", [".ts", ".tsx"]),
    ...filesUnder("src/server", [".ts", ".tsx"]),
    ...filesUnder("src/features", [".ts", ".tsx"]).filter(
      (file) => !file.includes(".test."),
    ),
    ...filesUnder("scripts", [".mjs", ".js", ".ts"]).filter(
      (file) =>
        !file.endsWith("rehearse-avatar-03-migration.mjs") &&
        !file.endsWith("check-midi-only.mjs"),
    ),
    "supabase/config.toml",
  ],
  [
    [
      "retired avatar upload/storage runtime",
      /process-profile-image|PROFILE_IMAGE_RECOVERY_SECRET|profile-images|public-avatars|reserve_profile_image_upload|complete_profile_image_upload/i,
    ],
    ["remote DiceBear renderer", /https?:\/\/(?:api\.)?dicebear\.com/i],
  ],
);

if (violations.length > 0) {
  console.error("MIDI-only static contract violations:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("MIDI-only static contract passed.");
