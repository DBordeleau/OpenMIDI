// PostgreSQL jsonb text orders object keys by length and then byte value and
// includes a space after separators. Published checksums use that representation.
export function serializePostgresJsonb(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(serializePostgresJsonb).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) =>
        left.length - right.length ||
        (left < right ? -1 : left > right ? 1 : 0),
    );
    return `{${entries
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}: ${serializePostgresJsonb(item)}`,
      )
      .join(", ")}}`;
  }
  throw new TypeError("Unsupported JSON value");
}

export async function sha256PostgresJsonb(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(serializePostgresJsonb(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
