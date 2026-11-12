---
name: bangkok-time-display
description: Use when a date or time shows in UTC, not Bangkok time.
category: date-time
---

# Bangkok time in school-facility-app

Every date or time shown to a user must be formatted in Asia/Bangkok, with the zone passed explicitly. The server runs in UTC (Vercel), so an unzoned formatter prints UTC: 11:40 Thai time shows as 04:40.

- Use `TZ` from `src/lib/time.ts` and pass `timeZone: TZ` to every `Intl.DateTimeFormat` or `toLocaleString` call.
- Reuse the helpers in `src/lib/time.ts` (`formatInstantHm`, `bangkokYmd`, `bangkokMinutes`, `atBangkok`, `formatDateShort`, `formatDayShort`, `formatDayLong`) before writing new formatting code.
- Thai day and month names are hand-written in `time.ts` on purpose, because Intl output differs between Node and browsers and breaks hydration. Do not switch to Intl for them.
- Before calling a time bug fixed, run the audit in references/time-audit.md and confirm every hit that formats a stored instant carries the zone.
- Regression test first: a failing case in `src/lib/*.test.ts` with a fixed UTC instant (04:40Z must render 11:40), then the fix. Run tests as in school-facility-app-verify.
