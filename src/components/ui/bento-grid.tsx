import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

function BentoGrid({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[minmax(15rem,auto)] grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12",
        className,
      )}
      {...props}
    />
  );
}

/** A bento tile: consistent surface, header row and scrollable body. */
function BentoCard({
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card p-5 text-card-foreground",
        "shadow-[0_1px_2px_rgba(0,0,0,.04),0_12px_32px_-12px_rgba(0,0,0,.12)] transition-shadow duration-300 hover:shadow-[0_1px_2px_rgba(0,0,0,.04),0_18px_40px_-12px_rgba(0,0,0,.2)]",
        "dark:shadow-[0_-20px_80px_-20px_#ffffff10_inset]",
        className,
      )}
      {...props}
    />
  );
}

export { BentoCard, BentoGrid };
