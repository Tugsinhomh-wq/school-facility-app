import { docxResponse, readExportRequest } from "@/app/(dashboard)/control/export/request";
import { csaToDocx } from "@/lib/control/docx";
import { listMissions } from "@/lib/data/control";

export const dynamic = "force-dynamic";

/** CSA of every mission of one group and fiscal year as .docx: ?fy=2569&group=general. Officers only. */
export async function GET(req: Request) {
  const r = await readExportRequest(req);
  if ("error" in r) return r.error;
  const { fy, group, groupLabel } = r.target;
  const { missions, failed } = await listMissions(fy);
  if (failed) return new Response("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง", { status: 500 });
  // A group with no mission still gets a valid file: just the heading.
  return docxResponse(
    await csaToDocx(missions.filter((m) => m.groupKey === group), { fiscalYear: fy, groupLabel }),
    `CSA-${groupLabel}-${fy}`,
    `csa-${group}-${fy}`,
  );
}
