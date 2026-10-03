"use client";

import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ReportForm,
  type BuildingOption,
} from "@/components/tickets/report-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

/** Floating report button for phones: a short form with the camera first. Signed-in users only. */
export function QuickReportFab() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const pathname = usePathname();
  // The summary and account pages are not for reporting repairs.
  const hidden = pathname === "/summary" || pathname === "/account";

  // Load the building list the first time the sheet opens, so pages do not pay for it.
  useEffect(() => {
    if (!open || buildings.length > 0) return;
    let cancelled = false;
    void createClient()
      .from("buildings")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (!cancelled && data) setBuildings(data as BuildingOption[]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, buildings.length]);

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
        aria-label="แจ้งซ่อม"
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex h-14 items-center gap-2 rounded-full bg-cta px-5 text-base font-semibold text-cta-foreground shadow-lg shadow-black/25 active:scale-95 md:bottom-6"
      >
        <Plus className="size-5" aria-hidden />
        แจ้งซ่อม
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-auto bottom-0 max-h-[92dvh] max-w-full translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))] sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">แจ้งซ่อม</DialogTitle>
            <DialogDescription>
              ถ่ายรูป เลือกอาคาร พิมพ์สั้นๆ แล้วกดส่ง
            </DialogDescription>
          </DialogHeader>
          <ReportForm
            key={formKey}
            buildings={buildings}
            onAnother={() => setFormKey((k) => k + 1)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
