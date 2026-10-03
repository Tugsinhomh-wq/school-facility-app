"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";

import { BentoCard } from "@/components/ui/bento-grid";
import { BorderBeam } from "@/components/ui/border-beam";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { ReportForm } from "@/components/tickets/report-form";
import type { BuildingOption } from "@/lib/data/dashboard";

export function QuickReportCard({
  buildings,
}: {
  buildings: BuildingOption[];
  canAttach?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Remount the form on each open so a previous success message is cleared.
  const [formKey, setFormKey] = useState(0);

  return (
    // Phones have the floating report button instead, so this card is hidden there.
    <BentoCard
      tone="royal"
      className="max-md:hidden md:col-span-3 lg:col-span-5 items-start justify-center gap-3"
    >
      <div className="flex size-11 items-center justify-center rounded-lg bg-cta text-cta-foreground">
        <Wrench className="size-5" aria-hidden />
      </div>
      <h2 className="font-display text-2xl font-semibold">
        พบสิ่งชำรุด แจ้งได้เลย
      </h2>
      <p className="max-w-md text-sm leading-relaxed text-white/75">
        กรอกอาคาร อาการ และความเร่งด่วน ฝ่ายอาคารสถานที่จะรับเรื่องเข้าคิวให้
      </p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setFormKey((k) => k + 1);
        }}
      >
        <DialogTrigger
          render={
            <ShimmerButton
              shimmerColor="#ffffff"
              background="#f2b04a"
              className="mt-1 text-sm font-semibold text-[#131f78]"
            />
          }
        >
          แจ้งซ่อม
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แจ้งซ่อมอาคารสถานที่</DialogTitle>
            <DialogDescription>
              เลือกอาคารและกรอกรายละเอียดให้ชัดเจน
            </DialogDescription>
          </DialogHeader>
          <ReportForm
            key={formKey}
            buildings={buildings}
            onAnother={() => setFormKey((k) => k + 1)}
          />
        </DialogContent>
      </Dialog>
      <BorderBeam
        size={140}
        duration={8}
        colorFrom="#f2b04a"
        colorTo="#ffffff"
      />
    </BentoCard>
  );
}
