/** Fault families, so "แอร์ไม่เย็น" and "แอร์น้ำหยด" count as the same kind of problem. */
const FAMILIES: string[][] = [
  ["หลอดไฟ", "ไฟขาด", "ไฟดับ", "ไฟไม่ติด", "โคมไฟ"],
  ["น้ำรั่ว", "รั่ว", "ท่อ", "น้ำซึม", "ท่อตัน"],
  ["แอร์", "เครื่องปรับอากาศ", "คอมแอร์"],
  ["ประตู", "กุญแจ", "ล็อก", "บานพับ"],
  ["ส้วม", "ก๊อก", "ห้องน้ำ", "สุขา", "โถ", "ชักโครก"],
  ["ปลั๊ก", "ไฟฟ้า", "สวิตช์", "ไฟช็อต", "เบรกเกอร์"],
  ["โต๊ะ", "เก้าอี้", "ครุภัณฑ์"],
  ["พัดลม"],
  ["หลังคา", "ฝ้า", "เพดาน"],
];

const familiesOf = (text: string) => {
  const out = new Set<number>();
  FAMILIES.forEach((words, i) => {
    if (words.some((w) => text.includes(w))) out.add(i);
  });
  return out;
};

/** Thai has no spaces, so compare runs of four letters as a fallback for faults outside the families. */
const shares4 = (a: string, b: string) => {
  const grams = new Set<string>();
  for (let i = 0; i + 4 <= a.length; i++) grams.add(a.slice(i, i + 4));
  for (let i = 0; i + 4 <= b.length; i++) if (grams.has(b.slice(i, i + 4))) return true;
  return false;
};

const clean = (s: string) => s.replace(/\s+/g, "");

/** Does an open ticket (title + spot) look like the report being typed? */
export function looksSimilar(typed: string, candidate: string): boolean {
  const a = clean(typed);
  const b = clean(candidate);
  if (a.length < 3) return false;
  const fa = familiesOf(a);
  if (fa.size > 0) return [...familiesOf(b)].some((f) => fa.has(f));
  return shares4(a, b);
}
