"use client";

import { X } from "lucide-react";
import { startTransition, useActionState, useRef, type FormEvent } from "react";

import {
  changeRoomAdvisor,
  type SetupResult,
} from "@/app/(dashboard)/cleaning/manage/actions";
import { field, Result } from "@/components/cleaning/classroom-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SetupRoom } from "@/lib/data/cleaning-setup";

/** Where the page lists active accounts (`<datalist>`), one copy for every room. */
export const PEOPLE_LIST = "advisor-people";

/** Advisors of one room as removable names, plus a box to add a teacher by name or email. */
export function AdvisorPanel({ room }: { room: SetupRoom }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch, pending] = useActionState<SetupResult, FormData>(
    async (prev, fd) => {
      const r = await changeRoomAdvisor(prev, fd);
      if (r?.ok && !fd.get("remove") && inputRef.current)
        inputRef.current.value = "";
      // The clicked name may be gone after a removal, so focus returns to the box.
      inputRef.current?.focus();
      return r;
    },
    null,
  );
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // With the submitter, only the pressed name's "remove" value is in the data.
    const fd = new FormData(
      e.currentTarget,
      (e.nativeEvent as SubmitEvent).submitter,
    );
    startTransition(() => dispatch(fd));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 px-2 pb-4 pt-1">
      <input type="hidden" name="classroom_id" value={room.id} />
      {/* The add row comes first in the DOM so Enter in the box adds; it is shown last. */}
      <div className="order-2 flex gap-2">
        <Input
          ref={inputRef}
          name="add"
          list={PEOPLE_LIST}
          aria-label={`เพิ่มครูที่ปรึกษาห้อง ${room.name} (พิมพ์ชื่อหรืออีเมล)`}
          placeholder="พิมพ์ชื่อหรืออีเมลของครู"
          autoComplete="off"
          spellCheck={false}
          className={`${field} min-w-0 flex-1`}
        />
        <Button type="submit" disabled={pending} className="h-11 shrink-0 px-5">
          {pending ? "กำลังบันทึก..." : "เพิ่ม"}
        </Button>
      </div>
      <div className="order-1 space-y-1.5">
        <h3 className="text-sm font-medium text-muted-foreground">
          ครูที่ปรึกษา
        </h3>
        {room.advisors.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {room.advisors.map((a) => (
              <li
                key={a.id}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-muted pl-3 text-sm"
              >
                {a.name}
                <button
                  type="submit"
                  name="remove"
                  value={a.id}
                  disabled={pending}
                  aria-label={`ถอด ${a.name} ออกจากห้อง ${room.name}`}
                  className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีครูที่ปรึกษา</p>
        )}
      </div>
      <div className="order-3">
        <Result state={state} />
      </div>
    </form>
  );
}
