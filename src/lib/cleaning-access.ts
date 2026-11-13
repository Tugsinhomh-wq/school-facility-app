import type { UserRole } from "../types/database.ts";

// Who manages the cleaning-zone module (/cleaning/manage). Mirrors the RLS policies in supabase/facility_02_cleaning.sql
// and supabase/cleaning_staff_02_policies.sql. Kept apart from isFacilityOfficer on purpose: that one also opens the
// student roster (census), which the cleaning-zone officer must not get. Listed here instead of imported from
// data/session.ts, which pulls in next/headers and cannot be loaded by `npm test`.
const CLEANING_MANAGERS: readonly UserRole[] = ["staff", "head", "super_admin", "cleaning_staff"];

export const isCleaningManager = (role?: UserRole | null): boolean => !!role && CLEANING_MANAGERS.includes(role);
