// Shapes the internal-control data layer hands to the pages. Types only, so client components and
// `npm test` can import them without touching server-only code (src/lib/data/control.ts re-exports them).
import type { ActionStatus, AssessResult, GroupKey } from "./forms.ts";

/** One improvement measure of a project: who does what by when. */
export type ControlAction = {
  id: string;
  description: string;
  /** Free text: the person in charge may have no account. */
  responsible: string;
  /** "YYYY-MM-DD" or null. */
  due: string | null;
  status: ActionStatus;
};

export type ControlProject = {
  id: string;
  fiscalYear: number;
  groupKey: GroupKey;
  name: string;
  budget: number | null;
  ownerId: string;
  ownerName: string;
  missionId: string | null;
  objective: string;
  riskIssue: string;
  riskCause: string;
  riskImpact: string;
  riskType: "F" | "C" | "O" | null;
  /** The owner's 1-5 scores. */
  likelihood: number | null;
  impact: number | null;
  /** The head's override, each axis on its own; null = use the owner's value on that axis. */
  headLikelihood: number | null;
  headImpact: number | null;
  existingControls: string;
  assessment: string;
  residualRisk: string;
  confirmed: boolean;
  confirmedAt: string | null;
  /** effectiveScore(...): the number every page and document uses; null = not scored yet. */
  score: number | null;
  actions: ControlAction[];
};

/** A mission of one group in one fiscal year with its five CSA steps. */
export type ControlMission = {
  id: string;
  fiscalYear: number;
  groupKey: GroupKey;
  name: string;
  objective: string;
  procedures: string;
  practice: string;
  assessment: string;
  improvement: string;
};

/** One principle of the ปค.4: the staff's comment and result (null = not answered yet). */
export type PrincipleEntry = { result: AssessResult | null; text: string };

/** The ปค.4 assessment of one group in one fiscal year; after mapping, principles has keys 1-17 and summaries 1-5. */
export type ControlAssessment = {
  fiscalYear: number;
  groupKey: GroupKey;
  principles: Record<number, PrincipleEntry>;
  /** The typed "สรุป/วิธีการที่ควรปฏิบัติ" of each component. */
  summaries: Record<number, string>;
  updatedAt: string | null;
};
