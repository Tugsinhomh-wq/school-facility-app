import { canReview } from "@/lib/control/access";
import { GROUPS, type GroupKey } from "@/lib/control/forms";
import { parseExportQuery } from "@/lib/control/params";
import { fiscalYear } from "@/lib/control/risk";
import { getSession } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";

// What the two download routes (export/pk5 and export/csa) do the same way: who may ask, what they
// asked for, and how the .docx is sent back.

export type ExportTarget = { fy: number; group: GroupKey; groupLabel: string };

/**
 * Officers only (403 for everyone else, executives and signed-out visitors included), then one named
 * group and a well-formed year (400). `error` is the response to send as it is.
 */
export async function readExportRequest(req: Request): Promise<{ target: ExportTarget } | { error: Response }> {
  const session = await getSession();
  if (!session || !canReview(session.viewer.role)) return { error: new Response("ไม่มีสิทธิ์", { status: 403 }) };
  const sp = new URL(req.url).searchParams;
  const q = parseExportQuery({ fy: sp.get("fy") ?? undefined, group: sp.get("group") ?? undefined }, fiscalYear(bangkokYmd(new Date())));
  if (!q.ok) return { error: new Response(q.message, { status: 400 }) };
  const { fy, group } = q.value;
  return { target: { fy, group, groupLabel: GROUPS.find((g) => g.key === group)?.label ?? group } };
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
