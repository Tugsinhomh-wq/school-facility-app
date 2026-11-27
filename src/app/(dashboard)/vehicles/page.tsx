import { VehicleDesk } from "@/components/vehicle/vehicle-desk";
import { LoadError } from "@/components/ui/state-card";
import { getVehiclePage } from "@/lib/data/vehicles";
import { canBookVehicle, guardExecutive, isVehicleApprover } from "@/lib/data/session";
import { bangkokYmd, isYmd, mondayOf } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ขอใช้รถ | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

/**
 * Booking the school's vehicles. Everyone signed in books and sees the week. The director (an executive) also lands
 * here, to decide on requests: guardExecutive lets that one role through. Other executives are sent to the summary.
 */
export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ week?: string; error?: string }> }) {
  await guardExecutive("executive");
  const sp = await searchParams;
  const weekStart = mondayOf(isYmd(sp.week) ? sp.week : bangkokYmd(new Date()));
  const data = await getVehiclePage(weekStart);
  const role = data.viewer?.role;

  if (data.failed)
    return (
      <>
        <h1 className="mb-6 font-display text-3xl font-medium tracking-tight">ขอใช้รถ</h1>
        <LoadError what="ตารางรถ" retryHref="/vehicles" />
      </>
    );
  if (data.vehicles.length === 0)
    return (
      <>
        <h1 className="mb-6 font-display text-3xl font-medium tracking-tight">ขอใช้รถ</h1>
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">ยังไม่มีรถที่เปิดให้ขอใช้ ให้ผู้ดูแลรันไฟล์ vehicles_01.sql ใน Supabase ก่อน</p>
      </>
    );

  return (
    <VehicleDesk
      key={weekStart}
      vehicles={data.vehicles}
      bookings={data.bookings}
      pending={data.pending}
      mine={data.mine}
      weekStart={weekStart}
      userId={data.userId}
      // The demo (no viewer) lets the form be tried; a signed-in summary-only role cannot book.
      canBook={role === undefined ? true : canBookVehicle(role)}
      isApprover={isVehicleApprover(role)}
      live={data.source === "supabase"}
      sample={data.source === "mock"}
      error={sp.error}
    />
  );
}
