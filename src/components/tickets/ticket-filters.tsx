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

  const chips: [string | undefined, string][] = [[undefined, "ทั้งหมด"], ...Object.entries(STATUS_LABEL)];

  return (
    <div className="space-y-3">
      <nav aria-label="กรองตามสถานะ" className="flex flex-wrap gap-2">
        {chips.map(([value, label]) => {
          const active = filters.status === value;
          return (
            <Link
              key={label}
              href={statusHref(value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1 text-sm transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/80 hover:bg-muted",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <form method="get" className="flex flex-wrap items-center gap-2">
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
          <Button variant="ghost" nativeButton={false} render={<Link href={statusHref(filters.status)} />}>
            ล้างตัวกรอง
          </Button>
        )}
      </form>
    </div>
  );
}
