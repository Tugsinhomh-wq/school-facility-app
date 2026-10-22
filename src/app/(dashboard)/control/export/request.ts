import { canReview } from "@/lib/control/access";
import { GROUPS, type GroupKey } from "@/lib/control/forms";
import { parseExportQuery, parseYearQuery } from "@/lib/control/params";
import { fiscalYear } from "@/lib/control/risk";
import { getSession } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";

// What the download routes (export/pk5, csa, pk4 and pk1) do the same way: who may ask, what they
// asked for, and how the .docx is sent back.

export type ExportTarget = { fy: number; group: GroupKey; groupLabel: string };

/** Officers only: 403 for everyone else, executives and signed-out visitors included. */
async function officerOnly(): Promise<Response | null> {
  const session = await getSession();
  return !session || !canReview(session.viewer.role) ? new Response("ไม่มีสิทธิ์", { status: 403 }) : null;
}

const currentFiscalYear = () => fiscalYear(bangkokYmd(new Date()));

/** Officers only, then one named group and a well-formed year (400). `error` is the response to send as it is. */
export async function readExportRequest(req: Request): Promise<{ target: ExportTarget } | { error: Response }> {
  const denied = await officerOnly();
  if (denied) return { error: denied };
  const sp = new URL(req.url).searchParams;
  const q = parseExportQuery({ fy: sp.get("fy") ?? undefined, group: sp.get("group") ?? undefined }, currentFiscalYear());
  if (!q.ok) return { error: new Response(q.message, { status: 400 }) };
  const { fy, group } = q.value;
  return { target: { fy, group, groupLabel: GROUPS.find((g) => g.key === group)?.label ?? group } };
}

/** Like readExportRequest, for a school-wide document: officers only, then just a well-formed year. */
export async function readYearRequest(req: Request): Promise<{ fy: number } | { error: Response }> {
  const denied = await officerOnly();
  if (denied) return { error: denied };
  const q = parseYearQuery({ fy: new URL(req.url).searchParams.get("fy") ?? undefined }, currentFiscalYear());
  return q.ok ? { fy: q.value.fy } : { error: new Response(q.message, { status: 400 }) };
}

/** `name` is the Thai file name shown to the user; `asciiName` is the fallback for clients that ignore filename*. */
export function docxResponse(body: Buffer, name: string, asciiName: string): Response {
  const safe = name.replace(/[\\/:*?"<>|]+/g, "-");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${asciiName}.docx"; filename*=UTF-8''${encodeURIComponent(safe)}.docx`,
      "Cache-Control": "private, no-store",
    },
  });
}
