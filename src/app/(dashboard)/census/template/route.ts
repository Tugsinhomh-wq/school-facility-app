import { censusTemplateXlsx } from "@/lib/census-sheet";
import { getSession, isFacilityOfficer } from "@/lib/data/session";

/** The roster spreadsheet template: three headers and fake example rows. Facility officers only. */
export async function GET() {
  const session = await getSession();
  if (!session || !isFacilityOfficer(session.viewer.role)) return new Response("ไม่มีสิทธิ์", { status: 403 });
  return new Response(new Uint8Array(await censusTemplateXlsx()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="census-template.xlsx"; filename*=UTF-8''${encodeURIComponent("แม่แบบรายชื่อนักเรียน")}.xlsx`,
      "Cache-Control": "private, no-store",
    },
  });
}
