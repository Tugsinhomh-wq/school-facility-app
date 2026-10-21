import { reportRows } from "@/lib/cleaning-report";
import { reportXlsx } from "@/lib/cleaning-sheet";
import { getReportData } from "@/lib/data/cleaning-officer";
import { addDays, bangkokYmd, formatDayShort, isYmd } from "@/lib/time";

const MAX_DAYS = 400;

/** The cleaning summary as .xlsx for ?from=YYYY-MM-DD&to=YYYY-MM-DD. Facility officers only. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const from = q.get("from");
  const to = q.get("to");
  if (!isYmd(from) || !isYmd(to) || from > to || addDays(from, MAX_DAYS) < to) {
    return new Response("ช่วงวันที่ไม่ถูกต้อง", { status: 400 });
  }
  const data = await getReportData(from, to);
  if (!data) return new Response("ไม่มีสิทธิ์", { status: 403 });
  if ("failed" in data)
    return new Response("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง", { status: 500 });

  const result = reportRows({
    ...data,
    from,
    to,
    today: bangkokYmd(new Date()),
  });
  const title = `สรุปการยืนยันเขตทำความสะอาด ${formatDayShort(from)} – ${formatDayShort(to)}`;
  return new Response(new Uint8Array(await reportXlsx(title, result)), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cleaning-${from}_${to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
