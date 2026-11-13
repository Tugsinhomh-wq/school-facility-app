"use client";

import { useState } from "react";

import { ReportForm, type BuildingOption } from "@/components/tickets/report-form";
import { cn } from "@/lib/utils";

/**
 * The report form on the page itself. "plate" is the staff queue's square, ruled sheet under the table;
 * "well" is a regular user's rounded card beside their own list. After a report is sent, "แจ้งเรื่องอื่นเพิ่ม"
 * starts a fresh form (the key remounts it).
 */
export function NewReportCard({
  buildings,
  variant,
  className,
}: {
  buildings: BuildingOption[];
  variant: "plate" | "well";
  className?: string;
}) {
  const [formKey, setFormKey] = useState(0);
  return (
    <section
      id="new"
      aria-labelledby="new-report"
      className={cn(
        "scroll-mt-6",
        variant === "plate"
          ? "border-2 border-foreground bg-card p-4 sm:p-6"
          : "rounded-2xl bg-secondary p-4 shadow-xs sm:p-6",
        className,
      )}
    >
      <h2 id="new-report" className="font-display text-2xl font-medium leading-snug">
        แจ้งซ่อมใหม่
      </h2>
      <p className="mt-0.5 mb-4 text-muted-foreground">ถ่ายรูป เลือกอาคาร แตะอาการ แล้วกดส่ง</p>
      <ReportForm key={formKey} buildings={buildings} onAnother={() => setFormKey((k) => k + 1)} />
    </section>
  );
}
