// Pure risk logic for the internal-control module (no Next or Supabase imports, so `npm test` can load it).

/**
 * Thai fiscal year (พ.ศ.) of a "YYYY-MM-DD" day: it starts on 1 October, so
 * 2026-09-30 is 2569 and 2026-10-01 is 2570.
 */
export function fiscalYear(ymd: string): number {
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  return month >= 10 ? year + 544 : year + 543;
}

const isLevel = (n: number | null): n is number => n !== null && Number.isInteger(n) && n >= 1 && n <= 5;

/** Likelihood x impact, or null unless both are whole numbers from 1 to 5. */
export function riskScore(l: number | null, i: number | null): number | null {
  return isLevel(l) && isLevel(i) ? l * i : null;
}

export type RiskLevel = "extreme" | "high" | "moderate" | "low";

/** 16-25 extreme, 9-15 high, 4-8 moderate, below 4 low. */
export function riskLevel(score: number): RiskLevel {
  if (score >= 16) return "extreme";
  if (score >= 9) return "high";
  if (score >= 4) return "moderate";
  return "low";
}

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  extreme: "สูงมาก",
  high: "สูง",
  moderate: "ปานกลาง",
  low: "ต่ำ",
};

/** The score to use everywhere: the head's likelihood/impact win over the owner's, each on its own. */
export function effectiveScore(p: {
  likelihood: number | null;
  impact: number | null;
  headLikelihood: number | null;
  headImpact: number | null;
}): number | null {
  return riskScore(p.headLikelihood ?? p.likelihood, p.headImpact ?? p.impact);
}

/** A project is listed in ปค.5 from score 9 up; an unscored project never is. */
export const needsPk5 = (score: number | null): boolean => score !== null && score >= 9;
