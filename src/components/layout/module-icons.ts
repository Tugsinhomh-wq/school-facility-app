import { DoorOpen, ShieldCheck, Sparkles, Users, Wrench, type LucideIcon } from "lucide-react";

/** Icon for each module id in `src/lib/modules.ts`. */
export const MODULE_ICONS: Record<string, LucideIcon> = {
  repair: Wrench,
  rooms: DoorOpen,
  cleaning: Sparkles,
  census: Users,
  control: ShieldCheck,
};
