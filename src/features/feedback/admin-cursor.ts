import {
  decodeNavigationCursor,
  type NavigationCursor,
} from "@/features/navigation/cursor";

export function decodeAdminFeedbackCursor(
  value: string | undefined,
  adminId: string,
  filter: string,
): NavigationCursor | null | undefined {
  if (!value) return undefined;
  const cursor = decodeNavigationCursor(value);
  if (
    !cursor ||
    cursor.kind !== "admin-feedback" ||
    cursor.subject !== adminId ||
    cursor.filter !== filter
  ) {
    return null;
  }
  return cursor;
}
