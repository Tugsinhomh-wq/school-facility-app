"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import {
  createRepairTicket,
  type ReportResult,
} from "@/app/(dashboard)/actions";
import { ImagePicker } from "@/components/tickets/image-picker";
import { SimilarTickets } from "@/components/tickets/similar-tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const URGENCY_CHOICES = [
  { value: "medium", label: "ปกติ", hint: "ซ่อมตามคิว" },
  { value: "high", label: "ด่วน", hint: "กระทบการใช้งาน" },
  {
    value: "emergency",
    label: "ฉุกเฉิน",
    hint: "อันตรายหรือกระทบการเรียนทันที",
  },
] as const;

/** Common faults: one tap fills the title, so most reports need no typing. */
const SYMPTOMS = [
  "หลอดไฟขาด",
  "น้ำรั่ว",
  "แอร์ไม่เย็น",
  "ประตู/กุญแจเสีย",
  "ส้วม/ก๊อกน้ำเสีย",
  "ปลั๊กไฟ/ไฟฟ้า",
  "โต๊ะเก้าอี้ชำรุด",
];

export interface BuildingOption {
  id: string;
  name: string;
}

type FieldName = "building" | "title";

function validate(
  buildingId: string,
  title: string,
): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  if (!buildingId) errors.building = "เลือกอาคารที่พบปัญหา";
  if (title.trim().length < 3)
    errors.title = title.trim()
      ? "เขียนอาการให้ชัดขึ้นอีกนิด (อย่างน้อย 3 ตัวอักษร)"
      : "บอกว่าเสียตรงไหน เป็นอะไร หรือแตะตัวเลือกด้านบน";
  return errors;
}

const FIELD_ID: Record<FieldName, string> = {
  building: "q-building",
  title: "q-title",
};
const FIELD_LABEL: Record<FieldName, string> = {
  building: "อาคาร",
  title: "เสียตรงไหน เป็นอะไร",
};

const selectClass =
  "h-12 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive dark:bg-input/30";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/**
 * The phone-first report form: camera first, one tap for common faults, checked as you go.
 * Errors show under the field after you leave it, and a summary at the top links to each one.
 */
export function ReportForm({
  buildings,
  onAnother,
}: {
  buildings: BuildingOption[];
  onAnother: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [urgency, setUrgency] = useState<string>("medium");
  const [title, setTitle] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [spot, setSpot] = useState("");
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>(
    {},
  );
  const [submitted, setSubmitted] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<
    ReportResult | null,
    FormData
  >(createRepairTicket, null);

  const errors = validate(buildingId, title);
  const shown = (f: FieldName) =>
    touched[f] || submitted ? errors[f] : undefined;
  const failed = (Object.keys(errors) as FieldName[]).filter(
    (f) => submitted && errors[f],
  );

  if (state?.ok) {
    return (
      <div className="space-y-4 py-4 text-center" role="status">
        <CheckCircle2
          className="mx-auto size-12 text-emerald-600"
          aria-hidden
        />
        <p className="text-lg font-semibold">{state.message}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {state.ticketId && (
            <Button
              nativeButton={false}
              render={<Link href={`/tickets/${state.ticketId}`} />}
              className="h-12 text-base"
            >
              ดูเรื่องที่แจ้ง
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            onClick={onAnother}
          >
            แจ้งเรื่องอื่นเพิ่ม
          </Button>
        </div>
      </div>
    );
  }

  const focusField = (f: FieldName) =>
    document.getElementById(FIELD_ID[f])?.focus();

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        setSubmitted(true);
        if (Object.keys(errors).length > 0) {
          e.preventDefault();
          // Let the summary render, then move focus to it so screen readers announce what is wrong.
          requestAnimationFrame(() => summary.current?.focus());
        }
      }}
      className="space-y-5"
    >
      {(failed.length > 0 || (state && !state.ok)) && (
        <div
          ref={summary}
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-destructive/30"
        >
          <p className="font-semibold text-destructive">
            {failed.length > 0
              ? "ยังส่งไม่ได้ ตรวจสอบข้อมูลก่อน"
              : "ส่งไม่สำเร็จ"}
          </p>
          {failed.length > 0 ? (
            <ul className="mt-1 list-inside list-disc">
              {failed.map((f) => (
                <li key={f}>
                  <a
                    href={`#${FIELD_ID[f]}`}
                    onClick={(e) => {
                      e.preventDefault();
                      focusField(f);
                    }}
                    className="underline underline-offset-2"
                  >
                    {FIELD_LABEL[f]}: {errors[f]}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">{state?.message}</p>
          )}
        </div>
      )}

      <ImagePicker onBusyChange={setBusy} camera />

      <div className="space-y-1.5">
        <Label htmlFor="q-building">
          อาคาร{" "}
          <span className="text-destructive" aria-hidden>
            *
          </span>
          <span className="sr-only">(จำเป็น)</span>
        </Label>
        <select
          id="q-building"
          name="building_id"
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, building: true }))}
          aria-invalid={Boolean(shown("building"))}
          aria-describedby={shown("building") ? "q-building-error" : undefined}
          className={selectClass}
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
        <FieldError id="q-building-error" message={shown("building")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="q-title">
          เสียตรงไหน เป็นอะไร{" "}
          <span className="text-destructive" aria-hidden>
            *
          </span>
          <span className="sr-only">(จำเป็น)</span>
        </Label>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="อาการที่พบบ่อย"
        >
          {SYMPTOMS.map((sym) => (
            <button
              key={sym}
              type="button"
              aria-pressed={title === sym}
              onClick={() => {
                setTitle(sym);
                setTouched((t) => ({ ...t, title: true }));
              }}
              className={cn(
                "min-h-11 cursor-pointer rounded-full border px-4 text-sm transition-colors",
                title === sym
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card hover:bg-muted",
              )}
            >
              {sym}
            </button>
          ))}
          <button
            type="button"
            onClick={() => titleInput.current?.focus()}
            className="min-h-11 cursor-pointer rounded-full border border-dashed border-input px-4 text-sm text-muted-foreground hover:bg-muted"
          >
            อื่นๆ พิมพ์เอง
          </button>
        </div>
        <Input
          ref={titleInput}
          id="q-title"
          name="title"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, title: true }))}
          aria-invalid={Boolean(shown("title"))}
          aria-describedby={shown("title") ? "q-title-error" : undefined}
          placeholder="เช่น หลอดไฟห้อง 112 ขาด"
          className="h-12 text-base"
        />
        <FieldError id="q-title-error" message={shown("title")} />
      </div>

      <SimilarTickets buildingId={buildingId} text={`${title}${spot}`} />

      <div className="space-y-1.5">
        <Label htmlFor="q-loc">ห้องหรือจุดที่พบ (ถ้ามี)</Label>
        <Input
          id="q-loc"
          name="location_detail"
          value={spot}
          onChange={(e) => setSpot(e.target.value)}
          maxLength={120}
          placeholder="เช่น หน้าโรงอาหาร"
          className="h-12 text-base"
        />
      </div>

      <fieldset className="space-y-2">
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
                "h-12 cursor-pointer rounded-lg border text-base font-medium transition-colors",
                urgency === u.value
                  ? u.value === "emergency"
                    ? "border-red-700 bg-red-700 text-white"
                    : "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {u.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {URGENCY_CHOICES.find((u) => u.value === urgency)?.hint}
        </p>
      </fieldset>

      <Button
        type="submit"
        variant="cta"
        disabled={pending || busy}
        className="h-14 w-full text-base"
      >
        {pending
          ? "กำลังส่ง..."
          : busy
            ? "กำลังอัปโหลดรูป..."
            : "ส่งเรื่องแจ้งซ่อม"}
      </Button>
    </form>
  );
}
