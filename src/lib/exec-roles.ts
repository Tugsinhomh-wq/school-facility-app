import type { UserRole } from "../types/database.ts";

/** Summary-only roles: they never use the working modules. The budget deputy also gets the open-repairs page. */
export const isExecutive = (role?: UserRole | null) => role === "executive" || role === "budget_deputy";
