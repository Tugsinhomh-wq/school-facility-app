"use client";

import { useState } from "react";

import { ReportForm, type BuildingOption } from "@/components/tickets/report-form";

/**
 * The report form on the page itself, in a regular user's rounded card beside their own list. After a report
 * is sent, "แจ้งเรื่องอื่นเพิ่ม" starts a fresh form (the key remounts it).
 */
export function NewReportCard({ buildings }: { buildings: BuildingOption[] }) {
  const [formKey, setFormKey] = useState(0);
  return (
    <section
      id="new"
      aria-labelledby="new-report"
      className="scroll-mt-6 rounded-2xl bg-secondary p-4 shadow-xs sm:p-6"
    >
      <h2 id="new-report" className="font-display text-2xl font-medium leading-snug">
        แจ้งซ่อมใหม่
      </h2>
      <p className="mt-0.5 mb-4 text-muted-foreground">ถ่ายรูป เลือกอาคาร แตะอาการ แล้วกดส่ง</p>
      <ReportForm key={formKey} buildings={buildings} onAnother={() => setFormKey((k) => k + 1)} />
    </section>
  );
}
