const ALLOWED_DESTINATIONS = ["/onboarding", "/settings/profile"];

export function sanitizeNextPath(
  value: string | null | undefined,
  fallback = "/onboarding",
) {
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\")
  )
    return fallback;
  try {
    const url = new URL(decoded, "https://jam-session.invalid");
    if (url.origin !== "https://jam-session.invalid") return fallback;
    const allowed = ALLOWED_DESTINATIONS.some(
      (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
    );
    return allowed ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
