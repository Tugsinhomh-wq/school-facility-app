"use client";

import { MessageSquarePlus } from "lucide-react";
import { useActionState, useState } from "react";

import {
  sendFeedback,
  type FeedbackResult,
} from "@/app/(dashboard)/account/actions";
import { LAST_PAGE_KEY } from "@/components/layout/last-page-tracker";
import { ImagePicker } from "@/components/tickets/image-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const KINDS = [
  { value: "problem", label: "พบปัญหา" },
  { value: "request", label: "ขอเพิ่ม" },
  { value: "praise", label: "คำชม" },
  { value: "other", label: "อื่นๆ" },
] as const;

function readLastPage() {
  try {
    return sessionStorage.getItem(LAST_PAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function FeedbackForm() {
  const [kind, setKind] = useState<string>("problem");
  const [busy, setBusy] = useState(false);
  // Read once when the sheet opens: the form is mounted only while it is open.
  const [lastPage] = useState(readLastPage);
  const [state, action, pending] = useActionState<
    FeedbackResult | null,
    FormData
  >(sendFeedback, null);

  if (state?.ok)
    return (
      <p className="py-6 text-center text-base font-medium">
        🙏 {state.message}
      </p>
    );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="page_url" value={lastPage} />
      <div
        className="grid grid-cols-4 gap-2"
        role="radiogroup"
        aria-label="ประเภท"
      >
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            onClick={() => setKind(k.value)}
            className={cn(
              "h-11 rounded-lg border text-sm font-medium transition-colors",
              kind === k.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fb-message">ข้อความ</Label>
        <Textarea
          id="fb-message"
          name="message"
          required
          maxLength={2000}
          rows={5}
          placeholder="เล่าสิ่งที่เจอ หรือสิ่งที่อยากให้ปรับปรุง"
          className="text-base"
        />
      </div>
      <ImagePicker
        bucket="feedback-images"
        label="แนบรูปหน้าจอ (ไม่บังคับ)"
        onBusyChange={setBusy}
      />
      {lastPage && (
        <p className="text-xs text-muted-foreground">
          ระบบจะแนบหน้าที่คุณเพิ่งเปิดมาด้วย ({lastPage})
          เพื่อให้หาที่มาของปัญหาได้ง่าย
        </p>
      )}
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending || busy}
        className="h-12 w-full text-base"
      >
        {pending
          ? "กำลังส่ง..."
          : busy
            ? "กำลังอัปโหลดรูป..."
            : "ส่งความคิดเห็น"}
      </Button>
    </form>
  );
}

/** "Send feedback" button for the account page: a sheet with type, message and screenshots. */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full text-base"
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <MessageSquarePlus aria-hidden />
        ส่งความคิดเห็นถึงผู้พัฒนา
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-auto bottom-0 max-h-[92dvh] max-w-full translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))] sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">ส่งความคิดเห็น</DialogTitle>
            <DialogDescription>
              บอกปัญหาหรือสิ่งที่อยากให้ปรับปรุงระบบนี้
            </DialogDescription>
          </DialogHeader>
          <FeedbackForm key={formKey} />
        </DialogContent>
      </Dialog>
    </>
  );
}
