# Unzoned date formatting audit

Run from the repo root:

    grep -rn "toLocale\|Intl.DateTimeFormat\|getHours\|getMinutes\|toTimeString" src --include=*.ts --include=*.tsx | grep -v "\.test\."

- A hit that formats a stored instant (ticket times, comments, feedback) must pass `timeZone: TZ`.
- Calendar-day math on "YYYY-MM-DD" strings done with `Date.UTC` or `getUTCDay` (for example `addDays`, `weekdayIndex`) is fine.

Known case: `formatDateTh` in `src/lib/ticket-meta.ts` used `Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" })` without a zone. It feeds the ticket table, the ticket detail page, the trash page, the memos page, and the feedback row. Adding `timeZone: TZ` fixed all of them at once.
