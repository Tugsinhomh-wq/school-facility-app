import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { chip } from "@/components/cleaning/officer-overview";
import { GROUPS, type GroupKey } from "@/lib/control/forms";
import { FISCAL_YEAR_MAX, FISCAL_YEAR_MIN } from "@/lib/control/parse";
import { controlHref } from "@/lib/control/params";

// The fiscal-year stepper and the group chips shared by the /control pages that list things by year
// and group. Plain links (?fy= and ?group=), so they work without JavaScript.

type Props = { path: string; fy: number; group?: GroupKey; currentFy: number };

const stepLink =
  "inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm tabular-nums outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/** "ปีงบประมาณ 2569" with the previous and next year beside it, and a way back to the current year. */
export function YearNav({ path, fy, group, currentFy }: Props) {
  return (
    <nav aria-label="เลือกปีงบประมาณ" className="flex flex-wrap items-center gap-2">
      {fy > FISCAL_YEAR_MIN && (
        <Link href={controlHref(path, { fy: fy - 1, group }, currentFy)} className={stepLink}>
          <ChevronLeft className="size-4" aria-hidden />
          <span className="sr-only">ปีงบประมาณ </span>
          {fy - 1}
        </Link>
      )}
      <span className="px-1 text-lg font-medium tabular-nums">
        ปีงบประมาณ {fy}
        {fy === currentFy && <span className="ml-2 text-sm font-normal text-muted-foreground">ปีปัจจุบัน</span>}
      </span>
      {fy < FISCAL_YEAR_MAX && (
        <Link href={controlHref(path, { fy: fy + 1, group }, currentFy)} className={stepLink}>
          <span className="sr-only">ปีงบประมาณ </span>
          {fy + 1}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
      {fy !== currentFy && (
        <Link
          href={controlHref(path, { fy: currentFy, group }, currentFy)}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ไปปีปัจจุบัน
        </Link>
      )}
    </nav>
  );
}

/** "ทุกกลุ่มงาน" and one chip per group; the chips scroll sideways on a phone. */
export function GroupNav({ path, fy, group, currentFy }: Props) {
  return (
    <nav
      aria-label="กรองกลุ่มงาน"
      className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0"
    >
      <Link href={controlHref(path, { fy }, currentFy)} aria-current={!group ? "page" : undefined} className={chip(!group)}>
        ทุกกลุ่มงาน
      </Link>
      {GROUPS.map((g) => (
        <Link
          key={g.key}
          href={controlHref(path, { fy, group: g.key }, currentFy)}
          aria-current={group === g.key ? "page" : undefined}
          className={chip(group === g.key)}
        >
          {g.label}
        </Link>
      ))}
    </nav>
  );
}
