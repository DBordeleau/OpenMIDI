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

export function buildMixFilename(input: {
  projectTitle: string;
  revisionNumber?: number;
}) {
  const project = sanitizeFilenamePart(input.projectTitle, "jam-session");
  const version = input.revisionNumber ? `r${input.revisionNumber}` : "draft";
  return `${project}-${version}-mix.wav`;
}
