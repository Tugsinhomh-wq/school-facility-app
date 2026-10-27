"use client";

import { useActionState } from "react";

import {
  saveAdvisorRooms,
  type UserResult,
} from "@/app/(dashboard)/users/actions";
import { Button } from "@/components/ui/button";
import type { LevelGroup } from "@/lib/advisors";
import { cn } from "@/lib/utils";

export type AdvisorRoom = { id: string; name: string };

/** Homeroom-advisor rooms of the latest term, ticked per level. Saving replaces this term's set only; posts the shown room ids so a changed list is refused. */
export function AdvisorRoomsForm({
  userId,
  term,
  levels,
  selected,
}: {
  userId: string;
  term: string;
  levels: LevelGroup<AdvisorRoom>[];
  selected: string[];
}) {
  const [state, action, pending] = useActionState<UserResult, FormData>(
    saveAdvisorRooms,
    null,
  );
  const ticked = new Set(selected);

  return (
    <form
      action={action}
      className="mt-4 space-y-3 border-t border-border pt-4"
    >
      <input type="hidden" name="id" value={userId} />
      {levels.flatMap((g) =>
        g.rooms.map((r) => (
          <input key={r.id} type="hidden" name="shown" value={r.id} />
        )),
      )}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">
          ห้องที่ปรึกษา ภาคเรียน {term}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          เลือกได้หลายห้อง ครูจะเห็นข้อมูลเฉพาะห้องที่เลือก
          ภาคเรียนก่อนหน้าไม่เปลี่ยน
        </p>
      </div>
      {levels.map((g) => (
        <fieldset key={g.level} className="min-w-0">
          <legend className="mb-1.5 text-sm font-medium">{g.level}</legend>
          <div className="flex flex-wrap gap-2">
            {g.rooms.map((r) => (
              <label
                key={r.id}
                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:font-medium has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
              >
                <input
                  type="checkbox"
                  name="room"
                  value={r.id}
                  defaultChecked={ticked.has(r.id)}
                  className="size-5 accent-[var(--primary)] outline-none"
                />
                {r.name}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full px-6 sm:w-auto"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกห้องที่ปรึกษา"}
        </Button>
        {state && (
          <p
            role={state.ok ? "status" : "alert"}
            className={cn(
              "text-sm font-medium",
              state.ok ? "text-emerald-800" : "text-destructive",
            )}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
