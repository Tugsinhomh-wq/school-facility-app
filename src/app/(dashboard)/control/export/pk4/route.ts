import { docxResponse, readExportRequest } from "@/app/(dashboard)/control/export/request";
import { pk4ToDocx } from "@/lib/control/docx";
import { getAssessment } from "@/lib/data/control";

export const dynamic = "force-dynamic";

/** ปค.4 of one group and fiscal year as .docx: ?fy=2569&group=general. Officers only. */
export async function GET(req: Request) {
  const r = await readExportRequest(req);
  if ("error" in r) return r.error;
  const { fy, group, groupLabel } = r.target;
  const { assessment, failed } = await getAssessment(fy, group);
  if (failed) return new Response("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง", { status: 500 });
  // A group not filled in yet still gets a valid file: every principle with an empty comment.
  return docxResponse(await pk4ToDocx(assessment, { fiscalYear: fy, groupLabel }), `ปค.4-${groupLabel}-${fy}`, `pk4-${group}-${fy}`);
}
