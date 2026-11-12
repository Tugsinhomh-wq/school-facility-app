import type { UserRole } from "../../types/database.ts";

/**
 * Who may delete a memo: the administrator any memo; staff (heads count as staff) only their own
 * memo while it is still a draft (final_status "pending", not yet approved, rejected or sent back).
 */
export function canDeleteMemo(
  role: UserRole | undefined,
  userId: string | undefined,
  memo: { author_id: string; final_status: string },
): boolean {
  if (role === "super_admin") return true;
  if (role === "staff" || role === "head")
    return Boolean(userId) && memo.author_id === userId && memo.final_status === "pending";
  return false;
}
