import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { CONFIRMED_TONE, RISK_TONE, UNSCORED_TONE } from "@/components/control/risk-tone";
import { Pill } from "@/components/tickets/status-mark";
import { LEVEL_LABEL, riskLevel } from "@/lib/control/risk";
import type { ControlProject } from "@/lib/control/types";

const baht = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

/** Risk level and score as icon + words, or "ยังไม่ให้คะแนน"; the colour only backs the words up. */
export function RiskPill({ score }: { score: number | null }) {
  if (score === null) return <Pill tone={UNSCORED_TONE} label="ยังไม่ให้คะแนน" />;
  const level = riskLevel(score);
  return <Pill tone={RISK_TONE[level]} label={`${LEVEL_LABEL[level]} (${score} คะแนน)`} />;
}

export const ConfirmedPill = () => <Pill tone={CONFIRMED_TONE} label="ยืนยันแล้ว" />;

/** One project in the overview: a plain row with a chevron, the way the home list looks. */
export function ProjectRow({ project, showOwner }: { project: ControlProject; showOwner: boolean }) {
  const meta = [showOwner ? project.ownerName : null, project.budget !== null ? `งบ ${baht.format(project.budget)} บาท` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <li>
      <Link
        href={`/control/projects/${project.id}`}
        className="flex min-h-16 items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5"
      >
        <span className="min-w-0 flex-1 leading-snug">
          <span className="block font-semibold break-words">{project.name}</span>
          {meta && <span className="mt-0.5 block text-sm break-words text-muted-foreground">{meta}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            <RiskPill score={project.score} />
            {project.confirmed && <ConfirmedPill />}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
