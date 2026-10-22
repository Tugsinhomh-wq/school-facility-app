import "server-only";

import { followUp, type FollowUpItem } from "@/lib/control/follow-up";
import type { GroupKey } from "@/lib/control/forms";
import {
  ASSESSMENT_SELECT,
  emptyAssessment,
  MISSION_SELECT,
  PROJECT_SELECT,
  toAssessment,
  toMission,
  toProject,
  type RawAssessment,
  type RawMission,
  type RawProject,
} from "@/lib/control/map";
import { FISCAL_YEAR_MAX, FISCAL_YEAR_MIN, isUuid } from "@/lib/control/parse";
import { fiscalYear } from "@/lib/control/risk";
import type { ControlAssessment, ControlMission, ControlProject } from "@/lib/control/types";
import { getSession } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";

export type { ControlAction, ControlAssessment, ControlMission, ControlProject } from "@/lib/control/types";

// Every query goes through the signed-in user's own client, so Row Level Security decides what comes
// back: an owner gets their own projects, an officer or executive gets all. No session = demo mode:
// an empty result, never sample data. A database error (or anything thrown) = `failed: true`, so the
// page shows an error with a retry instead of an empty list that looks like "no projects".

/** PostgREST returns at most this many rows a call. */
const PAGE = 1000;

/** One line for the server log: where, the error code and message only (never row data or user input). */
const logFailure = (where: string, e: unknown) => {
  const err = e as { code?: string; message?: string } | null;
  console.error(`[control] ${where} failed: ${err?.code ?? "-"} ${err?.message ?? ""}`);
};

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
    if (error) logFailure("listProjects", error);
    if (error || data.length >= PAGE) return { projects: [], failed: true };
    return { projects: (data as unknown as RawProject[]).map(toProject) };
  } catch (e) {
    logFailure("listProjects", e);
    return { projects: [], failed: true };
  }
}

/**
 * Every improvement measure of the current and the previous fiscal year (a ปค.5 of last year has
 * measures due this year), sorted by urgency as of today in Bangkok. Whose measures: whatever RLS
 * returns. Never throws; `failed` if either year could not be loaded (the other year's items are kept).
 */
export async function listFollowUp(): Promise<{ items: FollowUpItem[]; failed?: true }> {
  const today = bangkokYmd(new Date());
  const fy = fiscalYear(today);
  const [now, before] = await Promise.all([listProjects(fy), listProjects(fy - 1)]);
  return {
    items: followUp([...now.projects, ...before.projects], today),
    ...(now.failed || before.failed ? { failed: true as const } : {}),
  };
}

/** One project; null = not found or not visible to this user (RLS), which looks the same on purpose. */
export async function getProject(id: string): Promise<{ project: ControlProject | null; failed?: true }> {
  try {
    const s = await getSession();
    if (!s || !isUuid(id)) return { project: null };
    const { data, error } = await s.supabase.from("control_projects").select(PROJECT_SELECT).eq("id", id).maybeSingle();
    if (error) {
      logFailure("getProject", error);
      return { project: null, failed: true };
    }
    return { project: data ? toProject(data as unknown as RawProject) : null };
  } catch (e) {
    logFailure("getProject", e);
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
    if (error) logFailure("listMissions", error);
    if (error || data.length >= PAGE) return { missions: [], failed: true };
    return { missions: (data as unknown as RawMission[]).map(toMission) };
  } catch (e) {
    logFailure("listMissions", e);
    return { missions: [], failed: true };
  }
}

/** One mission; null = not found. */
export async function getMission(id: string): Promise<{ mission: ControlMission | null; failed?: true }> {
  try {
    const s = await getSession();
    if (!s || !isUuid(id)) return { mission: null };
    const { data, error } = await s.supabase.from("control_missions").select(MISSION_SELECT).eq("id", id).maybeSingle();
    if (error) {
      logFailure("getMission", error);
      return { mission: null, failed: true };
    }
    return { mission: data ? toMission(data as unknown as RawMission) : null };
  } catch (e) {
    logFailure("getMission", e);
    return { mission: null, failed: true };
  }
}

/** The ปค.4 of one group and year; a group not filled in yet is the empty one (nothing answered), not an error. Officers and executives only (RLS). */
export async function getAssessment(fy: number, groupKey: GroupKey): Promise<{ assessment: ControlAssessment; failed?: true }> {
  const empty = emptyAssessment(fy, groupKey);
  try {
    const s = await getSession();
    if (!s) return { assessment: empty };
    if (!validYear(fy)) return { assessment: empty, failed: true };
    const { data, error } = await s.supabase
      .from("control_assessments")
      .select(ASSESSMENT_SELECT)
      .eq("fiscal_year", fy)
      .eq("group_key", groupKey)
      .maybeSingle();
    if (error) {
      logFailure("getAssessment", error);
      return { assessment: empty, failed: true };
    }
    return { assessment: data ? toAssessment(data as unknown as RawAssessment) : empty };
  } catch (e) {
    logFailure("getAssessment", e);
    return { assessment: empty, failed: true };
  }
}
