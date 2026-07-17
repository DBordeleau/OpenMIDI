import { z } from "zod";

const cursorSchema = z.object({
  v: z.literal(1),
  kind: z.enum([
    "projects",
    "contributions",
    "profile-projects",
    "profile-contributions",
    "reports",
    "admin-moderation",
    "admin-feedback",
  ]),
  subject: z.string(),
  filter: z.string(),
  timestamp: z.string().datetime(),
  id: z.string().uuid(),
  discoveryVersion: z.number().int().positive().optional(),
});

export type NavigationCursor = z.infer<typeof cursorSchema>;

export function encodeNavigationCursor(cursor: NavigationCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeNavigationCursor(value: string | undefined) {
  if (!value || value.length > 512) return null;
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    return null;
  }
}
