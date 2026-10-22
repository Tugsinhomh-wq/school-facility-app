import { docxResponse, readExportRequest } from "@/app/(dashboard)/control/export/request";
import { pk5ToDocx } from "@/lib/control/docx";
import { pk5Rows } from "@/lib/control/pk5";
import { listProjects } from "@/lib/data/control";

export const dynamic = "force-dynamic";

/** ปค.5 of one group and fiscal year as .docx: ?fy=2569&group=general. Officers only. */
export async function GET(req: Request) {
  const r = await readExportRequest(req);
  if ("error" in r) return r.error;
  const { fy, group, groupLabel } = r.target;
  const { projects, failed } = await listProjects(fy);
  if (failed) return new Response("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง", { status: 500 });
  // A group with no confirmed project from 9 points up still gets a valid file: the heading and the signature.
  const rows = pk5Rows(projects.filter((p) => p.groupKey === group));
  return docxResponse(await pk5ToDocx(rows, { fiscalYear: fy, groupLabel }), `ปค.5-${groupLabel}-${fy}`, `pk5-${group}-${fy}`);
}
