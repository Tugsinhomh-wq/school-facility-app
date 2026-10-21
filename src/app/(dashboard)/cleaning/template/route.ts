import { templateXlsx } from "@/lib/cleaning-sheet";

/** The classroom spreadsheet template: the four headers and one example row (no real data). */
export async function GET() {
  return new Response(new Uint8Array(await templateXlsx()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="classrooms.xlsx"; filename*=UTF-8''${encodeURIComponent("แม่แบบห้องเรียน")}.xlsx`,
    },
  });
}
