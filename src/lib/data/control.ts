import "server-only";

import { MISSION_SELECT, PROJECT_SELECT, toMission, toProject, type RawMission, type RawProject } from "@/lib/control/map";
import { FISCAL_YEAR_MAX, FISCAL_YEAR_MIN, isUuid } from "@/lib/control/parse";
import type { ControlMission, ControlProject } from "@/lib/control/types";
import { getSession } from "@/lib/data/session";

export type { ControlAction, ControlMission, ControlProject } from "@/lib/control/types";

// Every query goes through the signed-in user's own client, so Row Level Security decides what comes
// back: an owner gets their own projects, an officer or executive gets all. No session = demo mode:
// an empty result, never sample data. A database error (or anything thrown) = `failed: true`, so the
// page shows an error with a retry instead of an empty list that looks like "no projects".

/** PostgREST returns at most this many rows a call. */
const PAGE = 1000;

const validYear = (fy: number) => Number.isInteger(fy) && fy >= FISCAL_YEAR_MIN && fy <= FISCAL_YEAR_MAX;

/** The fiscal year's projects with their owner's name and measures, oldest first. */
export async function listProjects(fy: number): Promise<{ projects: ControlProject[]; failed?: true }> {
  try {
    const s = await getSession();
    if (!s) return { projects: [] };
    if (!validYear(fy)) return { projects: [], failed: true };
    const { data, error } = await s.supabase
      .from("control_projects")
      .select(PROJECT_SELECT)
      .eq("fiscal_year", fy)
      .order("created_at")
      .order("id")
      .limit(PAGE);
    // A full page may have more behind it; showing part of the register as if it were all is worse than an error.
    if (error || data.length >= PAGE) return { projects: [], failed: true };
    return { projects: (data as unknown as RawProject[]).map(toProject) };
  } catch {
    return { projects: [], failed: true };
  }
}

/** One project; null = not found or not visible to this user (RLS), which looks the same on purpose. */
export async function getProject(id: string): Promise<{ project: ControlProject | null; failed?: true }> {
  try {
    const s = await getSession();
    if (!s || !isUuid(id)) return { project: null };
    const { data, error } = await s.supabase.from("control_projects").select(PROJECT_SELECT).eq("id", id).maybeSingle();
    if (error) return { project: null, failed: true };
    return { project: data ? toProject(data as unknown as RawProject) : null };
  } catch {
    return { project: null, failed: true };
  }
}

/** The fiscal year's missions, oldest first. Any signed-in user may read them. */
export async function listMissions(fy: number): Promise<{ missions: ControlMission[]; failed?: true }> {
  try {
    const s = await getSession();
    if (!s) return { missions: [] };
    if (!validYear(fy)) return { missions: [], failed: true };
    const { data, error } = await s.supabase
      .from("control_missions")
      .select(MISSION_SELECT)
      .eq("fiscal_year", fy)
      .order("created_at")
      .order("id")
      .limit(PAGE);
    if (error || data.length >= PAGE) return { missions: [], failed: true };
    return { missions: (data as unknown as RawMission[]).map(toMission) };
  } catch {
    return { missions: [], failed: true };
  }
}

/** One mission; null = not found. */
export async function getMission(id: string): Promise<{ mission: ControlMission | null; failed?: true }> {
  try {
    const s = await getSession();
    if (!s || !isUuid(id)) return { mission: null };
    const { data, error } = await s.supabase.from("control_missions").select(MISSION_SELECT).eq("id", id).maybeSingle();
    if (error) return { mission: null, failed: true };
    return { mission: data ? toMission(data as unknown as RawMission) : null };
  } catch {
    return { mission: null, failed: true };
  }
}
