const ACCIDENTAL: Record<string, string> = { sharp: "♯", flat: "♭" };

/**
 * Format a stored key slug for display with proper musical accidentals.
 * `"f-sharp-minor" → "F♯ minor"`, `"e-flat-major" → "E♭ major"`,
 * `"c-major" → "C major"`.
 */
export function formatMusicalKey(slug: string): string {
  const parts = slug.split("-");
  const tonic = (parts[0] ?? "").toUpperCase();
  const quality = parts[parts.length - 1] ?? "";
  const accidental =
    parts.length === 3 ? (ACCIDENTAL[parts[1] ?? ""] ?? "") : "";
  return `${tonic}${accidental} ${quality}`.trim();
}

/**
 * Compact badge form: `"f-sharp-minor" → "F♯m"`, `"e-flat-major" → "E♭"`,
 * `"a-minor" → "Am"`, `"c-major" → "C"`.
 */
export function formatMusicalKeyShort(slug: string): string {
  const parts = slug.split("-");
  const tonic = (parts[0] ?? "").toUpperCase();
  const quality = parts[parts.length - 1] ?? "";
  const accidental =
    parts.length === 3 ? (ACCIDENTAL[parts[1] ?? ""] ?? "") : "";
  return `${tonic}${accidental}${quality === "minor" ? "m" : ""}`;
}
