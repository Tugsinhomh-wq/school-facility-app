import type { UserRole } from "../../types/database.ts";

// Who may change a control project. Mirrors the RLS policies in supabase/control_01.sql.
// The officer roles are listed here instead of importing isStaffRole from data/session.ts, which
// pulls in next/headers and cannot be loaded by `npm test`; access.test.ts checks they still match.
const OFFICER_ROLES: readonly UserRole[] = ["staff", "head", "super_admin"];

export type ProjectAccess = { ownerId: string; confirmed: boolean };

/** Officers (staff, head, super_admin): same set as isStaffRole. They review and confirm projects. */
export const canReview = (role?: UserRole | null): boolean => !!role && OFFICER_ROLES.includes(role);

/** Officers always; the owner only until the head confirms the project; nobody else. */
export function canEditProject(p: ProjectAccess, viewer: { userId: string; role: UserRole | null }): boolean {
  if (canReview(viewer.role)) return true;
  return viewer.userId === p.ownerId && !p.confirmed;
}
