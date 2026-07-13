const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const ILLEGAL_FILENAME_CHARACTERS = /[\u0000-\u001f\u007f/\\:*?"<>|]/g;

export function sanitizeFilenamePart(value: string, fallback: string) {
  const cleaned = value
    .normalize("NFKC")
    .replace(ILLEGAL_FILENAME_CHARACTERS, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^[. -]+|[. ]+$/g, "")
    .slice(0, 96)
    .replace(/[. ]+$/g, "");
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  return RESERVED_WINDOWS_NAMES.test(cleaned) ? `_${cleaned}` : cleaned;
}

export function sourceExtension(mediaType: string) {
  if (mediaType === "audio/flac") return "flac";
  if (mediaType === "audio/mpeg") return "mp3";
  return "wav";
}

export function buildStemFilenames(
  tracks: ReadonlyArray<{
    assetId: string;
    name: string;
    mediaType: string;
    sortOrder: number;
  }>,
) {
  const used = new Map<string, number>();
  return tracks.map((track) => {
    const prefix = String(track.sortOrder + 1).padStart(2, "0");
    const fallback = `stem-${track.assetId.slice(0, 8)}`;
    const base = sanitizeFilenamePart(track.name, fallback);
    const key = `${prefix}-${base}`.toLocaleLowerCase("en-US");
    const occurrence = (used.get(key) ?? 0) + 1;
    used.set(key, occurrence);
    const suffix = occurrence > 1 ? `-${occurrence}` : "";
    return `${prefix}-${base.slice(0, 108 - suffix.length)}${suffix}.${sourceExtension(track.mediaType)}`;
  });
}

export function buildMixFilename(input: {
  projectTitle: string;
  revisionNumber?: number;
}) {
  const project = sanitizeFilenamePart(input.projectTitle, "jam-session");
  const version = input.revisionNumber ? `r${input.revisionNumber}` : "draft";
  return `${project}-${version}-mix.wav`;
}
