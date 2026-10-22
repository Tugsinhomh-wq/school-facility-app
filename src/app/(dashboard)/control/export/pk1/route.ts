import { docxResponse, readYearRequest } from "@/app/(dashboard)/control/export/request";
import { pk1ToDocx } from "@/lib/control/docx";
import { pk1Sections } from "@/lib/control/pk1";
import { listProjects } from "@/lib/data/control";

export const dynamic = "force-dynamic";

/** ปค.1 of the whole school for one fiscal year as .docx: ?fy=2569 (no group). Officers only. */
export async function GET(req: Request) {
  const r = await readYearRequest(req);
  if ("error" in r) return r.error;
  const { projects, failed } = await listProjects(r.fy);
  if (failed) return new Response("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง", { status: 500 });
  return docxResponse(await pk1ToDocx(pk1Sections(projects), { fiscalYear: r.fy }), `ปค.1-${r.fy}`, `pk1-${r.fy}`);
}
