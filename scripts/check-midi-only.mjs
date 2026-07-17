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

check(filesUnder("supabase/migrations", [".sql"]), [
  [
    "legacy audio/storage schema",
    /source[_-]?audio|waveform|workspace-snapshots|derived-assets/i,
  ],
  ["pre-pivot stem schema", /midi_stem|midi stems?/i],
  ["legacy runtime", /waveform-playlist|jam-session-composite/i],
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
]);

if (violations.length > 0) {
  console.error("MIDI-only static contract violations:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("MIDI-only static contract passed.");
