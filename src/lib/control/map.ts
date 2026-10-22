// Database rows of the internal-control tables to the camelCase shapes of ./types.ts. Pure, so
// `npm test` can load it; src/lib/data/control.ts does the querying.
import { ASSESS_RESULTS, COMPONENT_COUNT, PRINCIPLE_COUNT, type ActionStatus, type GroupKey } from "./forms.ts";
import { effectiveScore } from "./risk.ts";
import type { ControlAction, ControlAssessment, ControlMission, ControlProject, PrincipleEntry } from "./types.ts";

type One<T> = T | T[] | null;

export type RawAction = {
  id: string;
  project_id: string;
  description: string;
  responsible: string;
  due: string | null;
  status: ActionStatus;
  created_at: string;
};

export type RawProject = {
  id: string;
  fiscal_year: number;
  group_key: GroupKey;
  name: string;
  /** NUMERIC: PostgREST sends a number, but a long value may arrive as text. */
  budget: number | string | null;
  owner_id: string;
  mission_id: string | null;
  objective: string;
  risk_issue: string;
  risk_cause: string;
  risk_impact: string;
  risk_type: "F" | "C" | "O" | null;
  likelihood: number | null;
  impact: number | null;
  head_likelihood: number | null;
  head_impact: number | null;
  existing_controls: string;
  assessment: string;
  residual_risk: string;
  confirmed_at: string | null;
  owner: One<{ full_name: string }>;
  actions: RawAction[] | null;
};

export type RawMission = {
  id: string;
  fiscal_year: number;
  group_key: GroupKey;
  name: string;
  objective: string;
  procedures: string;
  practice: string;
  assessment: string;
  improvement: string;
};

export type RawAssessment = {
  fiscal_year: number;
  group_key: GroupKey;
  /** Any JSON: the database only guarantees an object, so every part is checked here. */
  items: unknown;
  updated_at: string | null;
};

const ACTION_COLUMNS = "id, project_id, description, responsible, due, status, created_at";

/**
 * control_projects has two foreign keys to profiles (owner_id and confirmed_by), so the embed must
 * say which one: a bare `profiles(...)` is refused by PostgREST as ambiguous.
 */
export const PROJECT_SELECT =
  "id, fiscal_year, group_key, name, budget, owner_id, mission_id, objective, risk_issue, risk_cause, risk_impact, " +
  "risk_type, likelihood, impact, head_likelihood, head_impact, existing_controls, assessment, residual_risk, " +
  `confirmed_at, owner:profiles!owner_id(full_name), actions:control_actions(${ACTION_COLUMNS})`;

export const MISSION_SELECT = "id, fiscal_year, group_key, name, objective, procedures, practice, assessment, improvement";

export const ASSESSMENT_SELECT = "fiscal_year, group_key, items, updated_at";

const first = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export const toAction = (r: RawAction): ControlAction => ({
  id: r.id,
  description: r.description,
  responsible: r.responsible,
  due: r.due,
  status: r.status,
});

export function toProject(r: RawProject): ControlProject {
  const budget = r.budget === null ? null : Number(r.budget);
  const actions = [...(r.actions ?? [])].sort(
    (a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return {
    id: r.id,
    fiscalYear: r.fiscal_year,
    groupKey: r.group_key,
    name: r.name,
    budget: budget !== null && Number.isFinite(budget) ? budget : null,
    ownerId: r.owner_id,
    // RLS shows some viewers only their own profile, so the name can be missing.
    ownerName: first(r.owner)?.full_name || "ไม่ทราบชื่อ",
    missionId: r.mission_id,
    objective: r.objective,
    riskIssue: r.risk_issue,
    riskCause: r.risk_cause,
    riskImpact: r.risk_impact,
    riskType: r.risk_type,
    likelihood: r.likelihood,
    impact: r.impact,
    headLikelihood: r.head_likelihood,
    headImpact: r.head_impact,
    existingControls: r.existing_controls,
    assessment: r.assessment,
    residualRisk: r.residual_risk,
    confirmed: r.confirmed_at !== null,
    confirmedAt: r.confirmed_at,
    score: effectiveScore({
      likelihood: r.likelihood,
      impact: r.impact,
      headLikelihood: r.head_likelihood,
      headImpact: r.head_impact,
    }),
    actions: actions.map(toAction),
  };
}

export const toMission = (r: RawMission): ControlMission => ({
  id: r.id,
  fiscalYear: r.fiscal_year,
  groupKey: r.group_key,
  name: r.name,
  objective: r.objective,
  procedures: r.procedures,
  practice: r.practice,
  assessment: r.assessment,
  improvement: r.improvement,
});

/** A plain JSON object, or an empty one for null, an array or a scalar. */
const objectOf = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** An assessment with nothing answered: keys 1-17 and 1-5 are all present. */
export function emptyAssessment(fiscalYear: number, groupKey: GroupKey): ControlAssessment {
  const principles: Record<number, PrincipleEntry> = {};
  for (let n = 1; n <= PRINCIPLE_COUNT; n++) principles[n] = { result: null, text: "" };
  const summaries: Record<number, string> = {};
  for (let n = 1; n <= COMPONENT_COUNT; n++) summaries[n] = "";
  return { fiscalYear, groupKey, principles, summaries, updatedAt: null };
}

/** The row's jsonb is untrusted: a part of the wrong shape, an unknown key or a bad result becomes empty and never throws. */
export function toAssessment(r: RawAssessment): ControlAssessment {
  const a = emptyAssessment(r.fiscal_year, r.group_key);
  const items = objectOf(r.items);
  const principles = objectOf(items.principles);
  const summaries = objectOf(items.summaries);
  for (let n = 1; n <= PRINCIPLE_COUNT; n++) {
    const p = objectOf(principles[n]);
    a.principles[n] = {
      result: ASSESS_RESULTS.find((x) => x.key === p.result)?.key ?? null,
      text: typeof p.text === "string" ? p.text : "",
    };
  }
  for (let n = 1; n <= COMPONENT_COUNT; n++) {
    const s = summaries[n];
    a.summaries[n] = typeof s === "string" ? s : "";
  }
  a.updatedAt = typeof r.updated_at === "string" ? r.updated_at : null;
  return a;
}
