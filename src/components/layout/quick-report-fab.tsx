"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { createRepairTicket, type ReportResult } from "@/app/(dashboard)/actions";
import { ImagePicker } from "@/components/tickets/image-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const URGENCY_CHOICES = [
  { value: "medium", label: "ปกติ" },
  { value: "high", label: "ด่วน" },
  { value: "emergency", label: "ฉุกเฉิน" },
] as const;

/** Common faults: one tap fills the title, so most reports need no typing. */
const SYMPTOMS = ["หลอดไฟขาด", "น้ำรั่ว", "แอร์ไม่เย็น", "ประตู/กุญแจเสีย", "ส้วม/ก๊อกน้ำเสีย", "ปลั๊กไฟ/ไฟฟ้า", "โต๊ะเก้าอี้ชำรุด"];

interface Building {
  id: string;
  name: string;
}

function QuickForm({ buildings }: { buildings: Building[] }) {
  const [busy, setBusy] = useState(false);
  const [urgency, setUrgency] = useState<string>("medium");
  const [title, setTitle] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<ReportResult | null, FormData>(createRepairTicket, null);

  if (state?.ok) {
    return <p className="py-6 text-center text-base font-medium">🎉 {state.message}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <ImagePicker onBusyChange={setBusy} camera />
      <div className="space-y-1.5">
        <Label htmlFor="q-building">อาคาร</Label>
        <select
          id="q-building"
          name="building_id"
          required
          defaultValue=""
          className="h-12 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="" disabled>
            {buildings.length === 0 ? "กำลังโหลดอาคาร..." : "เลือกอาคาร"}
          </option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="q-title">เสียตรงไหน เป็นอะไร</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="อาการที่พบบ่อย">
          {SYMPTOMS.map((sym) => (
            <button
              key={sym}
              type="button"
              aria-pressed={title === sym}
              onClick={() => setTitle(sym)}
              className={cn(
                "min-h-10 rounded-full border px-3.5 text-sm transition-colors",
                title === sym ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground",
              )}
            >
              {sym}
            </button>
          ))}
          <button type="button" onClick={() => titleInput.current?.focus()} className="min-h-10 rounded-full border border-dashed border-input px-3.5 text-sm text-muted-foreground">
            อื่นๆ พิมพ์เอง
          </button>
        </div>
        <Input ref={titleInput} id="q-title" name="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น หลอดไฟห้อง 112 ขาด" className="h-12 text-base" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="q-loc">ห้องหรือจุดที่พบ (ถ้ามี)</Label>
        <Input id="q-loc" name="location_detail" placeholder="เช่น หน้าโรงอาหาร" className="h-12 text-base" />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">ความเร่งด่วน</legend>
        <input type="hidden" name="urgency" value={urgency} />
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {URGENCY_CHOICES.map((u) => (
            <button
              key={u.value}
              type="button"
              role="radio"
              aria-checked={urgency === u.value}
              onClick={() => setUrgency(u.value)}
              className={cn(
                "h-12 rounded-lg border text-base font-medium transition-colors",
                urgency === u.value
                  ? u.value === "emergency"
                    ? "border-red-500 bg-red-500 text-white"
                    : "border-primary bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground",
              )}
            >
              {u.label}
            </button>
          ))}
        </div>
      </fieldset>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending || busy} className="h-12 w-full text-base">
        {pending ? "กำลังส่ง..." : busy ? "กำลังอัปโหลดรูป..." : "ส่งเรื่องแจ้งซ่อม"}
      </Button>
    </form>
  );
}

/** Floating report button for phones: a short form with the camera first. Signed-in users only. */
export function QuickReportFab() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [buildings, setBuildings] = useState<Building[]>([]);

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
        if (!cancelled && data) setBuildings(data as Building[]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, buildings.length]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
        aria-label="แจ้งซ่อม"
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex h-14 items-center gap-2 rounded-full bg-[#f2b04a] px-5 text-base font-semibold text-[#131f78] shadow-lg shadow-black/30 active:scale-95 md:bottom-6"
      >
        <Plus className="size-5" aria-hidden />
        แจ้งซ่อม
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-auto bottom-0 max-h-[92dvh] max-w-full translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))] sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">แจ้งซ่อม</DialogTitle>
            <DialogDescription>ถ่ายรูป เลือกอาคาร พิมพ์สั้นๆ แล้วกดส่ง</DialogDescription>
          </DialogHeader>
          <QuickForm key={formKey} buildings={buildings} />
        </DialogContent>
      </Dialog>
    </>
  );
}
