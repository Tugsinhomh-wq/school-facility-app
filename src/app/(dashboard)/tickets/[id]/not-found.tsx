import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function TicketNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-2xl font-bold">
        ไม่พบรายการแจ้งซ่อมนี้
      </h1>
      <p className="text-muted-foreground">
        รายการอาจถูกลบ หรือคุณไม่มีสิทธิ์ดูรายการนี้
      </p>
      <Button nativeButton={false} render={<Link href="/tickets" />}>
        กลับไปรายการแจ้งซ่อม
      </Button>
    </main>
  );
}
