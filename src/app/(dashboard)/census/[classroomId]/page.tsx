import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrivacyNotice } from "@/components/census/kit";
import { RosterList } from "@/components/census/roster-list";
import { LoadError } from "@/components/ui/state-card";
import { censusHref } from "@/lib/census-view";
import { isUuid } from "@/lib/control/parse";
import { getRoomRoster } from "@/lib/data/census";
import { getSession, guardExecutive, isFacilityOfficer } from "@/lib/data/session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "รายชื่อนักเรียนรายห้อง | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

/** One room's students by code. Officers can remove a student; a room the viewer cannot read is a 404. */
export default async function RoomRosterPage({ params }: { params: Promise<{ classroomId: string }> }) {
  await guardExecutive();
  const { classroomId } = await params;
  // A stray path never reaches the database: the uuid column would turn it into a load error.
  if (!isUuid(classroomId)) notFound();
  const [session, { room, students, failed }] = await Promise.all([getSession(), getRoomRoster(classroomId)]);
  const officer = isFacilityOfficer(session?.viewer.role);

  const back = (href: string) => (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden />
      สำมะโนผู้เรียน
    </Link>
  );

  if (failed) {
    return (
      <div className="mx-auto max-w-[640px] space-y-6">
        {back("/census")}
        <LoadError what="รายชื่อนักเรียน" retryHref={`/census/${classroomId}`} />
      </div>
    );
  }
  // Not found and not yours look the same on purpose (Row Level Security hides other people's rooms).
  if (!room) notFound();

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      {back(censusHref("/census", room.term))}
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-medium tracking-tight">{room.name}</h1>
        <p className="text-base tabular-nums">
          ภาคเรียน {room.term} · {students.length} คน
        </p>
        <PrivacyNotice />
      </div>
      {!session && <p className="text-sm text-muted-foreground">โหมดสาธิต: ยังไม่ได้เชื่อมต่อฐานข้อมูล ข้อมูลที่เห็นเป็นตัวอย่าง</p>}
      <RosterList students={students} officer={officer} term={room.term} />
    </div>
  );
}
