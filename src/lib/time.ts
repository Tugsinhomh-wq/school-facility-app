/** School time is Thailand time regardless of where the server or browser runs. */
export const TZ = "Asia/Bangkok";

const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "2026-09-30" for the Bangkok calendar day of an instant. */
export const bangkokYmd = (d: Date) => ymdFmt.format(d);

/** Minutes since Bangkok midnight. */
export function bangkokMinutes(d: Date) {
  const [h, m] = hmFmt.format(d).split(":").map(Number);
  return h * 60 + m;
}

/** The instant for a Bangkok date and minutes-since-midnight. */
export function atBangkok(ymd: string, minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return new Date(`${ymd}T${hh}:${mm}:00+07:00`);
}

export function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday. */
export const weekdayIndex = (ymd: string) => (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7;
export const mondayOf = (ymd: string) => addDays(ymd, -weekdayIndex(ymd));
export const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export const formatHm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export const formatInstantHm = (iso: string) => formatHm(bangkokMinutes(new Date(iso)));

// Hand-written Thai names: Intl output for th-TH differs between Node and browsers
// (e.g. "จันทร์" vs "จ."), which breaks hydration.
const DAYS_SHORT = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
const DAYS_LONG = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
const MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTHS_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const parts = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y: y + 543, m: m - 1, d, wd: weekdayIndex(ymd) };
};

/** "จ. 5 ต.ค." */
export function formatDayShort(ymd: string) {
  const { m, d, wd } = parts(ymd);
  return `${DAYS_SHORT[wd]} ${d} ${MONTHS_SHORT[m]}`;
}

/** "วันจันทร์ที่ 5 ตุลาคม 2569" */
export function formatDayLong(ymd: string) {
  const { y, m, d, wd } = parts(ymd);
  return `วัน${DAYS_LONG[wd]}ที่ ${d} ${MONTHS_LONG[m]} ${y}`;
}
