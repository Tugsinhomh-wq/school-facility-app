"use client";

import { ChevronDown } from "lucide-react";
import { startTransition, useActionState, useRef, type FormEvent } from "react";

import {
  saveClassroom,
  type SetupResult,
} from "@/app/(dashboard)/cleaning/manage/actions";
import { AdvisorPanel } from "@/components/cleaning/advisor-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SetupRoom } from "@/lib/data/cleaning-setup";
import { cn } from "@/lib/utils";

export const field = "h-11 text-base";
export const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

/** The action's answer, announced to screen readers; import errors listed by spreadsheet row. */
export function Result({ state }: { state: SetupResult }) {
  if (!state) return null;
  return (
    <div
      role={state.ok ? "status" : "alert"}
      className={cn(
        "text-sm",
        state.ok ? "text-emerald-700" : "text-destructive",
      )}
    >
      <p>{state.message}</p>
      {state.errors && state.errors.length > 0 && (
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          {state.errors.map((e, i) => (
            <li key={i}>
              <span className="font-semibold tabular-nums">แถว {e.row}:</span>{" "}
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Building = { id: string; name: string };

/**
 * saveClassroom, submitted by hand: a plain form `action` clears every field even when the save
 * is refused (say, one mistyped email), and the officer would have to type the room again.
 */
function useSave(resetOnOk: boolean) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState<SetupResult, FormData>(
    async (prev, fd) => {
      const r = await saveClassroom(prev, fd);
      if (r?.ok && resetOnOk) ref.current?.reset();
      return r;
    },
    null,
  );
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return { ref, state, pending, onSubmit };
}

function Fields({
  room,
  buildings,
  idp,
}: {
  room?: SetupRoom;
  buildings: Building[];
  idp: string;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idp}-name`}>ห้อง</Label>
          <Input
            id={`${idp}-name`}
            name="name"
            defaultValue={room?.name}
            required
            maxLength={40}
            placeholder="เช่น ม.3/2"
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idp}-b`}>อาคาร</Label>
          <select
            id={`${idp}-b`}
            name="building_id"
            defaultValue={room?.buildingId ?? ""}
            className={selectClass}
          >
            <option value="">ไม่ระบุ</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idp}-z`}>เขตทำความสะอาด</Label>
        <Input
          id={`${idp}-z`}
          name="zone"
          defaultValue={room?.zone}
          required
          maxLength={200}
          placeholder="เช่น ทางเดินหน้าอาคาร 2 ชั้น 1"
          className={field}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idp}-e`}>
          อีเมลครูที่ปรึกษา (หลายคนคั่นด้วยจุลภาค)
        </Label>
        <Input
          id={`${idp}-e`}
          name="advisor_emails"
          defaultValue={room?.advisorEmails.join(", ")}
          required
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          placeholder="somying@lrp.ac.th, somchai@lrp.ac.th"
          className={field}
        />
      </div>
    </>
  );
}

/** One classroom, folded to a summary line; open it to edit name, building, zone and advisors. */
export function ClassroomForm({
  room,
  buildings,
  editAdvisors,
}: {
  room: SetupRoom;
  buildings: Building[];
  /** True for active rooms of the latest term: advisors can be added and removed one by one. */
  editAdvisors: boolean;
}) {
  const { ref, state, pending, onSubmit } = useSave(false);
  const building = buildings.find((b) => b.id === room.buildingId)?.name;
  return (
    <details className={cn("group", !room.isActive && "opacity-70")}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-2 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{room.name}</span>
          {!room.isActive && (
            <span className="ml-2 text-xs text-muted-foreground">
              (ปิดใช้งาน)
            </span>
          )}
          <span className="block truncate text-sm text-muted-foreground">
            {[building, room.zone].filter(Boolean).join(" · ")}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {room.advisorEmails.length > 0
              ? room.advisorEmails.join(", ")
              : "ยังไม่มีครูที่ปรึกษา"}
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      {editAdvisors && <AdvisorPanel room={room} />}
      <form
        key={room.advisorEmails.join()}
        ref={ref}
        onSubmit={onSubmit}
        className="space-y-3 px-2 pb-4 pt-1"
      >
        <input type="hidden" name="id" value={room.id} />
        <Fields room={room} buildings={buildings} idp={room.id} />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={room.isActive}
            className="size-5 rounded border-input accent-[var(--primary)]"
          />
          ใช้งานในภาคเรียนนี้
          (เอาเครื่องหมายออกเพื่อซ่อนห้องจากหน้ายืนยันและภาพรวม)
        </label>
        <Result state={state} />
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full sm:w-auto"
        >
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </form>
    </details>
  );
}

/** Add one classroom to `term`; with no term yet, the officer types one. */
export function AddClassroomForm({
  term,
  buildings,
}: {
  term: string | null;
  buildings: Building[];
}) {
  const { ref, state, pending, onSubmit } = useSave(true);
  return (
    <form
      ref={ref}
      onSubmit={onSubmit}
      className="space-y-3 border-t border-border pt-6"
    >
      <h3 className="text-sm font-medium text-muted-foreground">
        เพิ่มห้องเรียน{term && ` ในภาคเรียน ${term}`}
      </h3>
      {term ? (
        <input type="hidden" name="term" value={term} />
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="new-term">ภาคเรียน</Label>
          <Input
            id="new-term"
            name="term"
            required
            pattern="\d{4}/[1-3]"
            placeholder="เช่น 2569/1"
            className={field}
          />
        </div>
      )}
      <Fields buildings={buildings} idp="new" />
      <Result state={state} />
      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full sm:w-auto"
      >
        {pending ? "กำลังเพิ่ม..." : "เพิ่มห้อง"}
      </Button>
    </form>
  );
}
