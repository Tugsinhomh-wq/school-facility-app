"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog, where "Save as PDF" is also offered. Hidden on the printed page itself. */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="h-11 gap-1.5 px-4 print:hidden">
      <Printer aria-hidden />
      พิมพ์ / บันทึกเป็น PDF
    </Button>
  );
}
