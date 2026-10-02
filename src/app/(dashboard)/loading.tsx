/** Shown instantly while a page's data loads, so a click never looks frozen. */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="กำลังโหลด"
      className="animate-pulse space-y-6"
    >
      <div className="h-24 rounded-xl bg-muted" />
      <div className="h-9 w-72 rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-6">
        <div className="h-44 rounded-xl bg-muted md:col-span-4" />
        <div className="h-44 rounded-xl bg-muted md:col-span-2" />
        <div className="h-56 rounded-xl bg-muted md:col-span-3" />
        <div className="h-56 rounded-xl bg-muted md:col-span-3" />
      </div>
    </div>
  );
}
