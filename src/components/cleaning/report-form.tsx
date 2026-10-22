import { Download } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Plain GET form: the browser downloads the .xlsx from /cleaning/report. */
export function ReportForm({ today, bad }: { today: string; bad?: boolean }) {
  return (
    <section
      id="report"
      aria-labelledby="report-title"
      className="space-y-3 border-t border-border pt-6"
    >
      <h2
        id="report-title"
        className="text-sm font-medium text-muted-foreground"
      >
        ดาวน์โหลดสรุปเป็น Excel
      </h2>
      <p className="text-sm text-muted-foreground">
        หนึ่งแถวต่อห้อง: วันที่ต้องยืนยัน ยืนยันแล้ว ร้อยละ
        และจำนวนวันที่ยังไม่ยืนยัน ห้องที่ต่ำกว่า 80% จะถูกแรเงา
      </p>
      {bad && (
        <p role="alert" className="text-sm text-destructive">
          ช่วงวันที่ไม่ถูกต้อง: ต้องเลือกวันเริ่มไม่หลังวันสิ้นสุด และยาวไม่เกิน
          400 วัน
        </p>
      )}
      <form
        action="/cleaning/report"
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="report-from">ตั้งแต่วันที่</Label>
          <Input
            id="report-from"
            name="from"
            type="date"
            required
            max={today}
            defaultValue={`${today.slice(0, 8)}01`}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-to">ถึงวันที่</Label>
          <Input
            id="report-to"
            name="to"
            type="date"
            required
            max={today}
            defaultValue={today}
            className="h-11 text-base"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          <Download className="size-4" aria-hidden />
          ดาวน์โหลด
        </button>
      </form>
    </section>
  );
}
