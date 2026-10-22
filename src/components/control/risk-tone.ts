import {
  ArrowDown,
  CircleAlert,
  CircleHelp,
  OctagonAlert,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import type { RiskLevel } from "@/lib/control/risk";

// Icon + colour of each risk level, for the Pill on the pages and the live score in the picker.
// Kept apart from the Pill itself: the picker is a client component and Pill drags in the data layer.
// Colour is never the only cue: every tone has its own icon and the level is always written out.
export type RiskTone = { icon: LucideIcon; className: string };

export const RISK_TONE: Record<RiskLevel, RiskTone> = {
  extreme: { icon: OctagonAlert, className: "text-red-700" },
  high: { icon: TriangleAlert, className: "text-amber-800" },
  moderate: { icon: CircleAlert, className: "text-foreground" },
  low: { icon: ArrowDown, className: "text-muted-foreground" },
};

export const UNSCORED_TONE: RiskTone = { icon: CircleHelp, className: "text-muted-foreground" };
export const CONFIRMED_TONE: RiskTone = { icon: ShieldCheck, className: "text-emerald-800" };
