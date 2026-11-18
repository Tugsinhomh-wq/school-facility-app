/** Count of tickets with a comment the viewer has not read yet; the parent places it. */
export function NavBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`${n} ใบมีความเห็นใหม่`}
      className={`min-w-5 rounded-full bg-red-700 px-1.5 py-0.5 text-center text-xs leading-none font-semibold text-white ${className ?? ""}`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
