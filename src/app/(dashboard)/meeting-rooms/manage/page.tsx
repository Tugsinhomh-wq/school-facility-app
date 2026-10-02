import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AddRoomForm,
  RoomManageForm,
} from "@/components/meeting/room-manage-form";
import { getManagedRooms } from "@/lib/data/rooms";
import { isRoomManager, guardExecutive } from "@/lib/data/session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "จัดการห้องประชุม | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
};

export default async function ManageRoomsPage() {
  await guardExecutive();
  const data = await getManagedRooms();
  if (!data || !isRoomManager(data.viewer?.role)) redirect("/meeting-rooms");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/meeting-rooms"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        ขอใช้ห้องประชุม
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        จัดการห้องประชุม
      </h1>
      <p className="text-muted-foreground">
        แก้ชื่อ จำนวนที่นั่ง อุปกรณ์ กฎการอนุมัติ และเปิดหรือปิดห้องให้จอง
        ห้องที่ปิดจะไม่แสดงในปฏิทิน
      </p>
      <div className="space-y-3">
        {data.rooms.map((r) => (
          <RoomManageForm
            key={`${r.id}-${r.name}-${r.capacity}-${r.requires_approval}-${r.is_bookable}-${r.equipment.join()}`}
            room={r}
          />
        ))}
        <AddRoomForm />
      </div>
    </div>
  );
}
