import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

function BentoGrid({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-auto grid-cols-1 gap-3 md:auto-rows-[minmax(15rem,auto)] md:grid-cols-6 lg:grid-cols-12",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A bento tile. "paper" is the quiet default; "royal" is the single filled
 * block on the page and is reserved for the primary action.
 */
function BentoCard({
  className,
  tone = "paper",
  ...props
}: ComponentPropsWithoutRef<"section"> & { tone?: "paper" | "royal" }) {
  return (
    <section
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl p-4 sm:p-5",
        tone === "paper" && "border border-border bg-card/85 text-card-foreground backdrop-blur-sm",
        tone === "royal" &&
          "bg-[linear-gradient(160deg,#2b3bb8,#131f78_70%)] text-white ring-1 ring-white/15",
        className,
      )}
      {...props}
    />
  );
}

export { BentoCard, BentoGrid };
