"use client";

import { useActionState, useEffect, useState } from "react";
import confetti from "canvas-confetti";
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
import { ImagePicker } from "@/components/tickets/image-picker";
import { Textarea } from "@/components/ui/textarea";
import type { BuildingOption } from "@/lib/data/dashboard";
import { URGENCY_LABEL } from "@/lib/ticket-meta";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function ReportForm({ buildings, canAttach }: { buildings: BuildingOption[]; canAttach: boolean }) {
  const [busy, setBusy] = useState(false);
  const [state, action, pending] = useActionState<ReportResult | null, FormData>(createRepairTicket, null);

  const succeeded = state?.ok === true;
  useEffect(() => {
    if (succeeded) {
      void confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#facc15", "#1d4ed8", "#ffffff"],
        zIndex: 9999,
        disableForReducedMotion: true,
      });
    }
  }, [succeeded]);

  if (state?.ok) {
    return (
      <div className="space-y-4 py-2 text-center">
        <p className="text-base font-medium">🎉 {state.message}</p>
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
          <Label htmlFor="building_id">อาคาร</Label>
          <select id="building_id" name="building_id" required defaultValue="" className={selectClass}>
            <option value="" disabled>เลือกอาคาร</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
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
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="location_detail">ห้องหรือจุดที่พบ (ถ้ามี)</Label>
        <Input id="location_detail" name="location_detail" placeholder="เช่น ห้อง 112 หรือหน้าโรงอาหาร" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">รายละเอียด</Label>
        <Textarea id="description" name="description" required rows={3} placeholder="อธิบายอาการหรือความเสียหาย" />
      </div>
      {canAttach ? (
        <ImagePicker onBusyChange={setBusy} />
      ) : (
        <p className="text-xs text-muted-foreground">เข้าสู่ระบบเพื่อแนบรูปประกอบได้</p>
      )}
      {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <Button type="submit" disabled={pending || busy} className="w-full">
        {pending ? "กำลังส่ง..." : busy ? "กำลังอัปโหลดรูป..." : "ส่งเรื่องแจ้งซ่อม"}
      </Button>
    </form>
  );
}

export function QuickReportCard({ buildings, canAttach }: { buildings: BuildingOption[]; canAttach: boolean }) {
  const [open, setOpen] = useState(false);
  // Remount the form on each open so a previous success message is cleared.
  const [formKey, setFormKey] = useState(0);

  return (
    // Phones have the floating report button instead, so this card is hidden there.
    <BentoCard tone="royal" className="max-md:hidden md:col-span-3 lg:col-span-7 items-start justify-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-lg bg-[#f2b04a] text-[#131f78]">
        <Wrench className="size-5" aria-hidden />
      </div>
      <h2 className="font-display text-2xl font-semibold">พบสิ่งชำรุด แจ้งได้เลย</h2>
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
        <DialogTrigger render={<ShimmerButton shimmerColor="#ffffff" background="#f2b04a" className="mt-1 text-sm font-semibold text-[#131f78]" />}>
          แจ้งซ่อม
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แจ้งซ่อมอาคารสถานที่</DialogTitle>
            <DialogDescription>เลือกอาคารและกรอกรายละเอียดให้ชัดเจน</DialogDescription>
          </DialogHeader>
          <ReportForm key={formKey} buildings={buildings} canAttach={canAttach} />
        </DialogContent>
      </Dialog>
      <BorderBeam size={140} duration={8} colorFrom="#f2b04a" colorTo="#ffffff" />
    </BentoCard>
  );
}
