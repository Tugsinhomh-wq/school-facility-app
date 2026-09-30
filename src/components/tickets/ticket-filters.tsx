import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BuildingOption } from "@/lib/data/dashboard";
import { STATUS_LABEL, URGENCY_LABEL } from "@/lib/ticket-meta";
import { cn } from "@/lib/utils";
import type { TicketFilters } from "@/types/tickets";

const selectClass =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-card";

/** Status chips are plain links; the rest is a GET form, so every filter state is a shareable URL. */
export function TicketFiltersBar({ filters, buildings }: { filters: TicketFilters; buildings: BuildingOption[] }) {
  const statusHref = (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (filters.urgency) params.set("urgency", filters.urgency);
    if (filters.building) params.set("building", filters.building);
    if (filters.q) params.set("q", filters.q);
    const qs = params.toString();
    return qs ? `/tickets?${qs}` : "/tickets";
  };

  // Clearing drops the search, building and urgency but keeps the chosen status.
  const clearHref = filters.status ? `/tickets?status=${filters.status}` : "/tickets";

  const chips: [string | undefined, string][] = [[undefined, "ทั้งหมด"], ...Object.entries(STATUS_LABEL)];

  return (
    <div className="space-y-3">
      <nav aria-label="กรองตามสถานะ" className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0">
        {chips.map(([value, label]) => {
          const active = filters.status === value;
          return (
            <Link
              key={label}
              href={statusHref(value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors sm:py-1",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/80 hover:bg-muted",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Phone: search stays in view, building and urgency fold into a panel. */}
      <form method="get" className="space-y-2 md:hidden">
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <div className="flex gap-2">
          <Input name="q" defaultValue={filters.q} placeholder="ค้นหาหัวข้อหรือเลขที่งาน" aria-label="ค้นหา" className="h-11 flex-1 text-base" />
          <Button type="submit" size="icon" className="size-11" aria-label="ค้นหา">
            <Search aria-hidden />
          </Button>
        </div>
        <details open={Boolean(filters.building || filters.urgency)} className="rounded-xl border border-border bg-card/70 p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <SlidersHorizontal className="size-4" aria-hidden />
            ตัวกรอง
            {(filters.building || filters.urgency) && (
              <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{[filters.building, filters.urgency].filter(Boolean).length}</span>
            )}
          </summary>
          <div className="mt-3 grid gap-2">
            <select name="building" defaultValue={filters.building ?? ""} aria-label="อาคาร" className={`${selectClass} h-11 text-base`}>
              <option value="">ทุกอาคาร</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select name="urgency" defaultValue={filters.urgency ?? ""} aria-label="ความเร่งด่วน" className={`${selectClass} h-11 text-base`}>
              <option value="">ทุกระดับความเร่งด่วน</option>
              {Object.entries(URGENCY_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button type="submit" className="h-11 flex-1">ใช้ตัวกรอง</Button>
              {(filters.q || filters.building || filters.urgency) && (
                <Button variant="outline" className="h-11" nativeButton={false} render={<Link href={clearHref} />}>
                  ล้าง
                </Button>
              )}
            </div>
          </div>
        </details>
      </form>

      <form method="get" className="hidden flex-wrap items-center gap-2 md:flex">
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <Input name="q" defaultValue={filters.q} placeholder="ค้นหาหัวข้อหรือเลขที่งาน" aria-label="ค้นหา" className="w-full sm:w-64" />
        <select name="building" defaultValue={filters.building ?? ""} aria-label="อาคาร" className={selectClass}>
          <option value="">ทุกอาคาร</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select name="urgency" defaultValue={filters.urgency ?? ""} aria-label="ความเร่งด่วน" className={selectClass}>
          <option value="">ทุกระดับความเร่งด่วน</option>
          {Object.entries(URGENCY_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <Button type="submit">ค้นหา</Button>
        {(filters.q || filters.building || filters.urgency) && (
          <Button variant="ghost" nativeButton={false} render={<Link href={clearHref} />}>
            ล้างตัวกรอง
          </Button>
        )}
      </form>
    </div>
  );
}
