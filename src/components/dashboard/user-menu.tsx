import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import type { Viewer } from "@/lib/data/dashboard";
import { ROLE_LABEL } from "@/lib/ticket-meta";

export function UserMenu({ viewer }: { viewer: Viewer | null }) {
  if (!viewer) {
    return (
      <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
        <LogIn aria-hidden />
        เข้าสู่ระบบ
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-right text-sm leading-tight">
        <span className="block font-medium">{viewer.name}</span>
        <span className="text-xs text-muted-foreground">{ROLE_LABEL[viewer.role]}</span>
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline" aria-label="ออกจากระบบ">
          <LogOut aria-hidden />
          ออกจากระบบ
        </Button>
      </form>
    </div>
  );
}
