"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  createCombinedMemo,
  createMemoFromTicket,
} from "@/app/(dashboard)/memos/actions";
import { Button } from "@/components/ui/button";
import {
  COMBINE_MAX,
  COMBINE_MIN,
  liveSelection,
  selectableTicket,
} from "@/lib/memo/combine";

function CombineButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="h-11">
      {pending ? "กำลังสร้าง..." : "รวมเป็นร่างเดียว"}
    </Button>
  );
}

/** A ticket without a memo. `detail` (place, urgency) is rendered by the server page: the pieces that draw it pull in server-only code. */
export interface Candidate {
  id: string;
  title: string;
  buildingId: string;
  buildingName: string;
  detail: ReactNode;
}

/**
 * Repair tickets that have no memo yet. Each row can get its own draft, or be ticked to join a
 * combined draft with other tickets of the same building (one memo to the director for all of them).
 */
export function CandidateList({ candidates }: { candidates: Candidate[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  // The list can refresh under us (a ticket got a memo meanwhile): only count what is still there.
  const live = liveSelection(
    picked,
    candidates.map((t) => t.id),
  );
  const first = candidates.find((t) => t.id === live[0]);
  const buildingId = first ? first.buildingId : null;
  const count = live.length;
  const tooFew = count < COMBINE_MIN;
  const tooMany = count > COMBINE_MAX;

  const toggle = (id: string) =>
    setPicked(live.includes(id) ? live.filter((x) => x !== id) : [...live, id]);

  return (
    <>
      {/* The ticks below belong to this form through their form="combine-form" attribute. */}
      <form id="combine-form" action={createCombinedMemo}>
        {count > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-muted/50 p-3">
            <p className="min-w-0 basis-full text-sm sm:basis-0 sm:flex-1" role="status">
              <span className="font-semibold">
                เลือกแล้ว {count} งาน · {first?.buildingName ?? ""}
              </span>
              {tooFew && (
                <span className="block text-muted-foreground">
                  เลือกอย่างน้อย {COMBINE_MIN} งานเพื่อรวมเป็นร่างเดียว
                </span>
              )}
              {tooMany && (
                <span className="block text-destructive">
                  รวมได้ไม่เกิน {COMBINE_MAX} งาน ยกเลิกบางงานก่อน
                </span>
              )}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => setPicked([])}
            >
              ล้างที่เลือก
            </Button>
            <CombineButton disabled={tooFew || tooMany} />
          </div>
        )}
      </form>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {candidates.map((t) => {
          const ok = selectableTicket(buildingId, t.buildingId);
          return (
            <li key={t.id} className="flex items-start gap-1 py-3.5 pr-4 pl-1">
              <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center has-[:disabled]:cursor-not-allowed">
                <input
                  type="checkbox"
                  name="ticket_ids"
                  value={t.id}
                  form="combine-form"
                  checked={live.includes(t.id)}
                  disabled={!ok}
                  onChange={() => toggle(t.id)}
                  aria-label={`เลือก ${t.title} เพื่อรวมเป็นร่างเดียว`}
                  className="size-5 accent-[var(--color-primary)] disabled:opacity-40"
                />
              </label>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{t.title}</p>
                {t.detail}
                {!ok && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    ต่างอาคารจากที่เลือก รวมด้วยกันไม่ได้
                  </p>
                )}
                <form action={createMemoFromTicket} className="mt-2">
                  <input type="hidden" name="ticket_id" value={t.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-11 w-full sm:w-auto"
                  >
                    ร่างบันทึกข้อความ
                  </Button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
