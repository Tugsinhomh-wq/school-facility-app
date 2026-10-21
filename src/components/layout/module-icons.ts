import {
  ChartColumn,
  DoorOpen,
  Ellipsis,
  FileText,
  House,
  Inbox,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Icon for each menu entry id in `src/lib/nav.ts` (the module ids come from `src/lib/modules.ts`). */
export const NAV_ICONS: Record<string, LucideIcon> = {
  home: House,
  repair: Wrench,
  rooms: DoorOpen,
  cleaning: Sparkles,
  census: Users,
  control: ShieldCheck,
  memos: FileText,
  summary: ChartColumn,
  feedback: Inbox,
  users: Users,
  trash: Trash2,
  account: UserRound,
  more: Ellipsis,
};
