"use client";

import { AlertTriangle, Check, Circle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { saveAssessment } from "@/app/(dashboard)/control/actions";
import { areaClass, useControlAction } from "@/components/control/form-kit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ASSESS_RESULTS, PK4_COLUMNS, PK4_COMPONENTS, PRINCIPLE_COUNT, SUMMARY_LABEL, type AssessResult } from "@/lib/control/forms";
import { MAX_TEXT } from "@/lib/control/parse";
import { pk4Counts } from "@/lib/control/pk4";
import type { ControlAssessment } from "@/lib/control/types";
import { bangkokYmd, formatDateShort, formatInstantHm } from "@/lib/time";
import { cn } from "@/lib/utils";

// "" is the default choice: not assessed yet. Posting it clears an earlier answer.
const CHOICES: readonly { key: AssessResult | ""; label: string }[] = [{ key: "", label: "ยังไม่ประเมิน" }, ...ASSESS_RESULTS];

/** "5 ต.ค. 2569 14:30 น." in Bangkok time. */
const savedAt = (iso: string) => `${formatDateShort(bangkokYmd(new Date(iso)))} ${formatInstantHm(iso)} น.`;

const LEAVE = "มีข้อความที่ยังไม่ได้บันทึก ออกจากหน้านี้ใช่ไหม";

/**
 * The ปค.4 form of one group and year: per principle a result and a typed comment, per component a typed
 * summary. Everything is posted on every save (the action replaces the whole assessment). The page keys
 * it on year + group, so switching starts from the other assessment. The fields stay as typed when a
 * save is refused, because the form is submitted by hand and never reset. It posts the `updated_at`
 * it last saw (the action refuses a save over a newer one) and warns before leaving with unsaved text.
 */
export function AssessForm({ assessment, demo }: { assessment: ControlAssessment; demo: boolean }) {
  // The action's token flow: the server's updated_at as loaded, then as returned by each save.
  const [loadedAt, setLoadedAt] = useState(assessment.updatedAt);
  // Input events seen vs. at the last save: different means unsaved text.
  const edits = useRef(0);
  const saved = useRef(0);
  const { state, pending, onSubmit } = useControlAction(async (prev, formData) => {
    const sent = edits.current;
    const r = await saveAssessment(prev, formData);
    if (r?.ok) {
      if (r.updatedAt) setLoadedAt(r.updatedAt);
      saved.current = sent;
    }
    return r;
  });
  useEffect(() => {
    const unsaved = () => edits.current !== saved.current;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (unsaved()) e.preventDefault();
    };
    // Capture phase on the document runs before Next's own link handler, so a cancelled click goes nowhere.
    const onClick = (e: MouseEvent) => {
      if (!unsaved() || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self")) return;
      if (a.origin === location.origin && a.pathname + a.search === location.pathname + location.search) return;
      if (!window.confirm(LEAVE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  // Only the radios are state, for the live counts; the text boxes are plain uncontrolled fields.
  const [results, setResults] = useState<Record<number, AssessResult | null>>(() =>
    Object.fromEntries(Object.entries(assessment.principles).map(([n, p]) => [n, p.result])),
  );
  const counts = pk4Counts({ ...assessment, principles: Object.fromEntries(Object.entries(results).map(([n, result]) => [n, { result, text: "" }])) });

  return (
    <form onSubmit={onSubmit} onChange={() => edits.current++} className="space-y-8">
      <input type="hidden" name="updated_at" value={loadedAt ?? ""} />
      <input type="hidden" name="fiscal_year" value={assessment.fiscalYear} />
      <input type="hidden" name="group_key" value={assessment.groupKey} />

      <div className="space-y-1">
        <p className="text-base">พิมพ์ความเห็นเอง ระบบไม่เขียนแทน</p>
        {/* Each count stays in one piece when the line wraps on a phone. */}
        <p className="text-base tabular-nums">
          จาก {PRINCIPLE_COUNT} ข้อ:{" "}
          {[
            ["ปฏิบัติครบ", counts.full],
            ["บางส่วน", counts.partial],
            ["ไม่พบ", counts.none],
            ["ยังไม่ประเมิน", counts.unanswered],
          ].map(([label, n], i) => (
            <span key={label}>
              {i > 0 && " · "}
              <span className="whitespace-nowrap">
                {label} {n}
              </span>
            </span>
          ))}
        </p>
      </div>

      {PK4_COMPONENTS.map((c) => (
        <section key={c.n} aria-labelledby={`c-${c.n}`} className="space-y-2">
          <h2 id={`c-${c.n}`} className="text-base font-semibold">
            องค์ประกอบที่ {c.n} {c.label}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {c.principles.map((p) => (
              <li key={p.n} className="space-y-3 px-4 py-4 sm:px-5">
                <p id={`p-${p.n}`} className="leading-snug break-words">
                  {p.n}) {p.text}
                </p>
                <div role="radiogroup" aria-labelledby={`p-${p.n}`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CHOICES.map((o) => {
                    const checked = (results[p.n] ?? "") === o.key;
                    return (
                      <label
                        key={o.key || "none-yet"}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                          checked ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/60",
                        )}
                      >
                        <input
                          type="radio"
                          name={`principle_${p.n}_result`}
                          value={o.key}
                          checked={checked}
                          onChange={() => setResults((r) => ({ ...r, [p.n]: o.key || null }))}
                          className="sr-only"
                        />
                        {checked ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                        {o.label}
                      </label>
                    );
                  })}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`t-${p.n}`} className="text-sm text-muted-foreground">
                    {PK4_COLUMNS[1]} ข้อ {p.n}
                  </Label>
                  <Textarea id={`t-${p.n}`} name={`principle_${p.n}_text`} defaultValue={assessment.principles[p.n]?.text ?? ""} maxLength={MAX_TEXT} className={areaClass} />
                </div>
              </li>
            ))}
            <li className="space-y-1.5 bg-muted/30 px-4 py-4 sm:px-5">
              <Label htmlFor={`s-${c.n}`}>
                {SUMMARY_LABEL} องค์ประกอบที่ {c.n}
              </Label>
              <Textarea id={`s-${c.n}`} name={`summary_${c.n}`} defaultValue={assessment.summaries[c.n] ?? ""} maxLength={MAX_TEXT} className={areaClass} />
            </li>
          </ul>
        </section>
      ))}

      {/* Sticks above the phone's bottom tab bar (3.5rem + its hairline + the safe area); at the very bottom on a desktop. */}
      <div className="sticky bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-30 -mx-4 border-t border-border bg-background px-4 py-3 sm:-mx-6 sm:px-6 md:bottom-0 md:mx-0 md:px-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="submit" disabled={pending || demo} className="h-11 px-6">
            {pending ? "กำลังบันทึก..." : "บันทึกผลประเมิน"}
          </Button>
          <div className="min-w-0 flex-1 basis-40 text-sm leading-snug">
            {state && (
              <p role={state.ok ? "status" : "alert"} className={cn("flex items-start gap-1.5", state.ok ? "text-emerald-800" : "text-destructive")}>
                {state.ok ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />}
                {state.message}
              </p>
            )}
            {demo ? (
              <p className="text-muted-foreground">โหมดสาธิต: ยังไม่ได้เชื่อมต่อฐานข้อมูล จึงบันทึกไม่ได้</p>
            ) : (
              loadedAt && (
                <p role="status" className="text-muted-foreground">
                  บันทึกครั้งล่าสุด {savedAt(loadedAt)}
                </p>
              )
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
