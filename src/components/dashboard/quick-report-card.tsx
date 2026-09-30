"use client";

import { useActionState, useState } from "react";
import { Wrench } from "lucide-react";

import { createRepairTicket, type ReportResult } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABEL, URGENCY_LABEL } from "@/lib/ticket-meta";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function ReportForm() {
  const [state, action, pending] = useActionState<ReportResult | null, FormData>(createRepairTicket, null);

  if (state?.ok) {
    return (
      <div className="space-y-4 py-2 text-center">
        <p className="text-sm">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="title">หัวข้อปัญหา</Label>
        <Input id="title" name="title" required placeholder="เช่น หลอดไฟห้องเรียนขาด" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="category">หมวดหมู่</Label>
          <select id="category" name="category" defaultValue="other" className={selectClass}>
            {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="urgency">ความเร่งด่วน</Label>
          <select id="urgency" name="urgency" defaultValue="medium" className={selectClass}>
            {Object.entries(URGENCY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location_building">อาคาร/สถานที่</Label>
          <Input id="location_building" name="location_building" required placeholder="เช่น อาคาร 1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location_room">ห้อง (ถ้ามี)</Label>
          <Input id="location_room" name="location_room" placeholder="เช่น ห้อง 112" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">รายละเอียด</Label>
        <Textarea id="description" name="description" required rows={3} placeholder="อธิบายอาการหรือความเสียหาย" />
      </div>
      {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "กำลังส่ง..." : "ส่งเรื่องแจ้งซ่อม"}
      </Button>
    </form>
  );
}

export function QuickReportCard() {
  const [open, setOpen] = useState(false);
  // Remount the form on each open so a previous success message is cleared.
  const [formKey, setFormKey] = useState(0);

  return (
    <BentoCard className="md:col-span-3 lg:col-span-7 items-start justify-center gap-3 bg-gradient-to-br from-card to-muted/60">
      <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Wrench className="size-5" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">แจ้งซ่อมด่วน</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        พบอาคาร ห้องเรียน หรือสิ่งแวดล้อมชำรุด แจ้งเรื่องได้ทันที ทีมอาคารสถานที่จะได้รับเรื่องเข้าคิวให้
      </p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setFormKey((k) => k + 1);
        }}
      >
        <DialogTrigger render={<ShimmerButton className="mt-1 text-sm font-medium" />}>
          แจ้งซ่อมอาคารสถานที่ใหม่
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แจ้งซ่อมอาคารสถานที่</DialogTitle>
            <DialogDescription>เลือกหมวดหมู่และกรอกรายละเอียดให้ชัดเจน</DialogDescription>
          </DialogHeader>
          <ReportForm key={formKey} />
        </DialogContent>
      </Dialog>
      <BorderBeam size={120} duration={8} colorFrom="#38bdf8" colorTo="#a78bfa" />
    </BentoCard>
  );
}
