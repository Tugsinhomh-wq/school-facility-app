import { bangkokYmd } from "@/lib/time";

/** Reporting periods for the executive summary: a calendar month or a school term. */
export type PeriodKind = "month" | "term";

export interface Period {
  kind: PeriodKind;
  /** "2026-10" for a month; "2026-1" for term 1 of the school year that starts in May 2026. */
  key: string;
  label: string;
  from: Date;
  to: Date;
  bucket: "day" | "month";
  prevKey: string;
  nextKey: string;
  /** Whether the next period has started yet. */
  hasNext: boolean;
}

const MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
export const MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const at = (ymd: string) => new Date(`${ymd}T00:00:00+07:00`);
const pad = (n: number) => String(n).padStart(2, "0");

/** Term 1 runs May–October, term 2 November–March; April is the break, counted with the term before it. */
function termOf(ymd: string) {
  const [y, m] = ymd.split("-").map(Number);
  if (m >= 5 && m <= 10) return { year: y, term: 1 };
  if (m >= 11) return { year: y, term: 2 };
  return { year: y - 1, term: 2 };
}

const nextTerm = ({ year, term }: { year: number; term: number }) =>
  term === 1 ? { year, term: 2 } : { year: year + 1, term: 1 };
const prevTerm = ({ year, term }: { year: number; term: number }) =>
  term === 2 ? { year, term: 1 } : { year: year - 1, term: 2 };
const termKey = (t: { year: number; term: number }) => `${t.year}-${t.term}`;
const termStart = ({ year, term }: { year: number; term: number }) =>
  at(term === 1 ? `${year}-05-01` : `${year}-11-01`);

export function resolvePeriod(
  kind: string | undefined,
  key: string | undefined,
  now = new Date(),
): Period {
  const today = bangkokYmd(now);
  if (kind === "term") {
    const m = /^(\d{4})-([12])$/.exec(key ?? "");
    const t = m ? { year: Number(m[1]), term: Number(m[2]) } : termOf(today);
    const next = nextTerm(t);
    return {
      kind: "term",
      key: termKey(t),
      label: `ภาคเรียนที่ ${t.term}/${t.year + 543}`,
      from: termStart(t),
      to: termStart(next),
      bucket: "month",
      prevKey: termKey(prevTerm(t)),
      nextKey: termKey(next),
      hasNext: termStart(next) <= now,
    };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  const [y, mo] =
    m && Number(m[2]) >= 1 && Number(m[2]) <= 12
      ? [Number(m[1]), Number(m[2])]
      : today.split("-").slice(0, 2).map(Number);
  const nextY = mo === 12 ? y + 1 : y;
  const nextM = mo === 12 ? 1 : mo + 1;
  const prevY = mo === 1 ? y - 1 : y;
  const prevM = mo === 1 ? 12 : mo - 1;
  const to = at(`${nextY}-${pad(nextM)}-01`);
  return {
    kind: "month",
    key: `${y}-${pad(mo)}`,
    label: `${MONTHS[mo - 1]} ${y + 543}`,
    from: at(`${y}-${pad(mo)}-01`),
    to,
    bucket: "day",
    prevKey: `${prevY}-${pad(prevM)}`,
    nextKey: `${nextY}-${pad(nextM)}`,
    hasNext: to <= now,
  };
}

/** The last `count` periods, newest first, for the memo form. */
export function recentPeriods(
  kind: PeriodKind,
  count: number,
  now = new Date(),
) {
  const out: Period[] = [];
  let p = resolvePeriod(kind, undefined, now);
  for (let i = 0; i < count; i++) {
    out.push(p);
    p = resolvePeriod(kind, p.prevKey, now);
  }
  return out;
}
