import { Marquee } from "@/components/ui/marquee";
import { meetingLine, type TodayMeeting } from "@/lib/data/rooms";

/** Thin bar above everything: today's approved meetings, the one in progress marked with a red dot. */
export function MeetingTicker({ meetings }: { meetings: TodayMeeting[] }) {
  const now = new Date().toISOString();
  return (
    <section aria-label="การประชุมวันนี้" className="border-b border-white/10 bg-[#131f78] text-white">
      {meetings.length === 0 ? (
        <p className="px-4 py-2 text-center text-sm text-white/80">วันนี้ยังไม่มีการประชุมที่ได้รับอนุมัติ</p>
      ) : (
        <Marquee pauseOnHover className="py-2 [--duration:45s] [--gap:3rem]">
          {meetings.map((m) => {
            const live = m.start_time <= now && now < m.end_time;
            return (
              <span key={m.id} className="flex items-center gap-2 whitespace-nowrap text-sm">
                <span className={live ? "size-2 rounded-full bg-red-400" : "size-2 rounded-full bg-[#f2b04a]"} aria-hidden />
                {live && <b className="font-semibold text-[#f2b04a]">กำลังประชุม</b>}
                {meetingLine(m)}
              </span>
            );
          })}
        </Marquee>
      )}
    </section>
  );
}
