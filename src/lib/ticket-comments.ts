import type { UserRole } from "../types/database.ts";

/** Who can read and write the comment thread on a ticket. Mirrors supabase/budget_deputy_02_comments.sql (head counts as staff there). */
export const COMMENT_ROLES: UserRole[] = ["budget_deputy", "head", "staff", "super_admin"];
export const COMMENT_MAX = 1000;

export const canComment = (role?: UserRole | null) => role != null && COMMENT_ROLES.includes(role);

/** The trimmed text of a comment, or null when it is empty, not text, or longer than COMMENT_MAX. */
export function cleanComment(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  return text.length >= 1 && text.length <= COMMENT_MAX ? text : null;
}
