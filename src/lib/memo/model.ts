import type { Memorandum } from "@/types/database";

export const SCHOOL_NAME = "โรงเรียนละหานทรายรัชดาภิเษก";
export const AGENCY = `${SCHOOL_NAME} กลุ่มงานบริหารทั่วไป`;
export const CLOSING = "จึงเรียนมาเพื่อโปรดพิจารณา";

/** Everything the three renderers (preview, PDF, Word) need, already formatted. */
export interface MemoDoc {
  agency: string;
  refNo: string;
  date: string;
  subject: string;
  recipient: string;
  paragraphs: string[];
  proposal: string | null;
  closing: string;
  signerName: string;
  signerPosition: string;
  /** Paper-hybrid memos carry a blank decision block for the director's handwritten sign-off. */
  decisionBlock: boolean;
}

/** The system's temporary number (MEMO-…) is not the official one; the real number comes from the general administration office. */
const isTemporaryRef = (ref: string) => !ref.trim() || /^MEMO-/i.test(ref.trim());

/**
 * Until the number is issued, the "ที่" line is left blank for it to be written in: "บท ........ / 2569".
 * The year is the year of the day the file is opened or exported, so it rolls over on its own.
 * A number that has been typed in (บท 123/2569) is never touched: it is the issued number.
 */
export function officialRef(docRefNo: string, now: string | Date = new Date()) {
  if (!isTemporaryRef(docRefNo)) return docRefNo.trim();
  // Buddhist year computed by hand: Intl adds a "พ.ศ." prefix in browsers but not in Node.
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date(now))) + 543;
  return `บท ........ / ${year}`;
}

export function formatThaiDate(input: string | Date) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric" }).format(new Date(input));
}

const splitParagraphs = (text: string) =>
  text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

export function buildMemoDoc(
  memo: Pick<Memorandum, "doc_ref_no" | "subject" | "recipient" | "body_content" | "proposal" | "approval_mode" | "created_at">,
  author: { full_name: string; position: string | null } | null,
): MemoDoc {
  return {
    agency: AGENCY,
    refNo: officialRef(memo.doc_ref_no),
    date: formatThaiDate(memo.created_at),
    subject: memo.subject,
    recipient: memo.recipient,
    paragraphs: splitParagraphs(memo.body_content),
    proposal: memo.proposal?.trim() || null,
    closing: CLOSING,
    signerName: author?.full_name ?? "",
    signerPosition: author?.position ?? "",
    decisionBlock: memo.approval_mode === "paper_hybrid",
  };
}

const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readInteger(n: number): string {
  if (n === 0) return "";
  if (n >= 1_000_000) return readInteger(Math.floor(n / 1_000_000)) + "ล้าน" + readInteger(n % 1_000_000);
  const digits = String(n).split("").map(Number);
  let out = "";
  digits.forEach((d, i) => {
    const place = digits.length - i - 1;
    if (d === 0) return;
    if (place === 0 && d === 1 && digits.length > 1) out += "เอ็ด";
    else if (place === 1 && d === 2) out += "ยี่สิบ";
    else if (place === 1 && d === 1) out += "สิบ";
    else out += DIGITS[d] + PLACES[place];
  });
  return out;
}

/** 4500 -> "สี่พันห้าร้อยบาทถ้วน", 1250.5 -> "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์" */
export function bahtText(amount: number): string {
  const satang = Math.round(amount * 100);
  const baht = Math.floor(satang / 100);
  const rest = satang % 100;
  const bahtPart = baht === 0 ? (rest === 0 ? "ศูนย์บาท" : "") : `${readInteger(baht)}บาท`;
  return rest === 0 ? `${bahtPart}ถ้วน` : `${bahtPart}${readInteger(rest)}สตางค์`;
}

export function formatBahtNumber(amount: number) {
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}
