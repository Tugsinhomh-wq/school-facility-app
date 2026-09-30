import { cn } from "@/lib/utils";

interface RetroGridProps extends React.HTMLAttributes<HTMLDivElement> {
  angle?: number;
  cellSize?: number;
  opacity?: number;
  lineColor?: string;
}

/**
 * Lightweight CSS-only variant of Magic UI's Retro Grid (the upstream version
 * is a WebGL shader; this uses its CSS fallback path, which is cheaper on
 * office machines).
 */
export function RetroGrid({
  className,
  angle = 65,
  cellSize = 60,
  opacity = 0.5,
  lineColor = "rgba(250, 204, 21, 0.35)",
  style,
  ...props
}: RetroGridProps) {
  return (
    <div
      className={cn("pointer-events-none absolute size-full overflow-hidden [perspective:200px]", className)}
      style={{ opacity, ...style }}
      aria-hidden="true"
      {...props}
    >
      <div className="absolute inset-0" style={{ transform: `rotateX(${angle}deg)` }}>
        <div
          className="animate-retro-grid absolute inset-[0%_0px] -ml-[200%] h-[300vh] w-[600vw] origin-[100%_0_0]"
          style={{
            backgroundImage: `linear-gradient(to right, ${lineColor} 1px, transparent 0), linear-gradient(to bottom, ${lineColor} 1px, transparent 0)`,
            backgroundSize: `${cellSize}px ${cellSize}px`,
            backgroundRepeat: "repeat",
          }}
        />
      </div>
      <div className="absolute inset-0 bg-linear-to-t from-background to-transparent to-90%" />
    </div>
  );
}
