import test from "node:test";
import assert from "node:assert/strict";
import { SOON_DAYS, dueText, followUp, followUpCounts, resolveBucket, type Bucket } from "./follow-up.ts";
import type { ActionStatus } from "./forms.ts";
import type { ControlProject } from "./types.ts";

const TODAY = "2026-10-22";

const project = (id: string, actions: { due: string | null; status?: ActionStatus; id?: string }[]): ControlProject =>
  ({
    id,
    name: `โครงการ ${id}`,
    groupKey: "general",
    ownerId: "u1",
    ownerName: "ครู ตัวอย่าง",
    actions: actions.map((a, i) => ({ id: a.id ?? `${id}-a${i}`, description: `มาตรการ ${i}`, responsible: "ผู้รับผิดชอบ", due: a.due, status: a.status ?? "open" })),
  }) as unknown as ControlProject;

const one = (due: string | null, status: ActionStatus = "open", today = TODAY) => followUp([project("p", [{ due, status }])], today)[0];

test("SOON_DAYS is 14", () => {
  assert.equal(SOON_DAYS, 14);
});

test("boundaries: yesterday is overdue, today and today+14 are soon, today+15 is later", () => {
  assert.deepEqual([one("2026-10-21").bucket, one("2026-10-21").days], ["overdue", -1]);
  assert.deepEqual([one("2026-10-22").bucket, one("2026-10-22").days], ["soon", 0]);
  assert.deepEqual([one("2026-11-05").bucket, one("2026-11-05").days], ["soon", 14]);
  assert.deepEqual([one("2026-11-06").bucket, one("2026-11-06").days], ["later", 15]);
});

test("done never alerts, whatever its date, and keeps no day count", () => {
  for (const due of ["2020-01-01", TODAY, "2026-10-30", "2030-01-01", null, "garbage"]) {
    const i = one(due, "done");
    assert.equal(i.bucket, "done");
    assert.equal(i.days, null);
  }
});

test("doing counts like open", () => {
  assert.equal(one("2026-10-01", "doing").bucket, "overdue");
  assert.equal(one("2026-10-25", "doing").bucket, "soon");
});

test("no due date is nodate and never an alert", () => {
  const i = one(null);
  assert.deepEqual([i.bucket, i.days], ["nodate", null]);
  assert.equal(followUpCounts([i]).alert, 0);
});

test("bad due strings are nodate and do not throw", () => {
  for (const due of ["", "abc", "2026-02-31", "2026-13-01", "2026-10-22T00:00:00Z", "22/10/2026", "2026-1-5", " 2026-10-22"]) {
    const i = one(due);
    assert.equal(i.bucket, "nodate", due);
    assert.equal(i.days, null);
  }
});

test("a bad today makes every dated measure nodate instead of throwing", () => {
  assert.equal(one("2026-10-22", "open", "").bucket, "nodate");
  assert.equal(one("2026-10-22", "open", "not-a-day").bucket, "nodate");
});

test("month rollover: 2026-10-22 + 14 is 2026-11-05, 31 October counts 9 days", () => {
  assert.equal(one("2026-10-31").days, 9);
  assert.equal(one("2026-11-01").days, 10);
  assert.equal(one("2026-09-30").days, -22);
});

test("year rollover: from 2026-12-25, 2027-01-08 is 14 days away and 2027-01-09 is 15", () => {
  assert.deepEqual([one("2027-01-08", "open", "2026-12-25").bucket, one("2027-01-08", "open", "2026-12-25").days], ["soon", 14]);
  assert.equal(one("2027-01-09", "open", "2026-12-25").bucket, "later");
  assert.equal(one("2026-12-31", "open", "2027-01-02").days, -2);
});

test("leap day: 2028-02-29 exists, 2027-02-29 does not", () => {
  assert.equal(one("2028-03-01", "open", "2028-02-28").days, 2);
  assert.equal(one("2028-02-29", "open", "2028-02-28").days, 1);
  assert.equal(one("2029-02-28", "open", "2028-02-28").days, 366);
  assert.equal(one("2027-02-29", "open", "2027-02-20").bucket, "nodate");
});

test("sorted: overdue (most overdue first), soon (nearest first), later, nodate, done", () => {
  const items = followUp(
    [
      project("a", [
        { id: "done", due: "2026-10-01", status: "done" },
        { id: "nodate", due: null },
        { id: "later", due: "2026-12-01" },
        { id: "soon-far", due: "2026-11-03" },
        { id: "over-1", due: "2026-10-21" },
      ]),
      project("b", [
        { id: "soon-near", due: "2026-10-22" },
        { id: "over-9", due: "2026-10-13" },
        { id: "later-2", due: "2026-11-20" },
      ]),
    ],
    TODAY,
  );
  assert.deepEqual(
    items.map((i) => i.actionId),
    ["over-9", "over-1", "soon-near", "soon-far", "later-2", "later", "nodate", "done"],
  );
  const buckets: Bucket[] = ["overdue", "overdue", "soon", "soon", "later", "later", "nodate", "done"];
  assert.deepEqual(items.map((i) => i.bucket), buckets);
});

test("equal days keep the order given", () => {
  const items = followUp([project("a", [{ id: "x", due: TODAY }, { id: "y", due: TODAY }]), project("b", [{ id: "z", due: TODAY }])], TODAY);
  assert.deepEqual(items.map((i) => i.actionId), ["x", "y", "z"]);
});

test("items carry the project and the measure", () => {
  const [i] = followUp([project("p1", [{ due: "2026-10-23" }])], TODAY);
  assert.deepEqual(i, {
    actionId: "p1-a0",
    projectId: "p1",
    projectName: "โครงการ p1",
    groupKey: "general",
    ownerId: "u1",
    ownerName: "ครู ตัวอย่าง",
    description: "มาตรการ 0",
    responsible: "ผู้รับผิดชอบ",
    due: "2026-10-23",
    status: "open",
    bucket: "soon",
    days: 1,
  });
});

test("no projects, or projects without measures, give an empty list", () => {
  assert.deepEqual(followUp([], TODAY), []);
  assert.deepEqual(followUp([project("p", [])], TODAY), []);
});

test("followUpCounts: alert is overdue + soon; later, nodate and done are left out", () => {
  const items = followUp(
    [
      project("p", [
        { due: "2026-10-01" },
        { due: "2026-10-21" },
        { due: "2026-10-22" },
        { due: "2026-11-05" },
        { due: "2026-11-06" },
        { due: null },
        { due: "2026-10-01", status: "done" },
      ]),
    ],
    TODAY,
  );
  assert.deepEqual(followUpCounts(items), { overdue: 2, soon: 2, alert: 4 });
  assert.deepEqual(followUpCounts([]), { overdue: 0, soon: 0, alert: 0 });
});

test("dueText", () => {
  assert.equal(dueText(one("2026-10-19")), "เกินกำหนด 3 วัน");
  assert.equal(dueText(one("2026-10-21")), "เกินกำหนด 1 วัน");
  assert.equal(dueText(one(TODAY)), "ครบกำหนดวันนี้");
  assert.equal(dueText(one("2026-10-27")), "อีก 5 วัน");
  assert.equal(dueText(one("2027-01-01")), "อีก 71 วัน");
  assert.equal(dueText(one(null)), "ยังไม่กำหนดวัน");
  assert.equal(dueText(one("bad")), "ยังไม่กำหนดวัน");
  assert.equal(dueText(one("2026-10-01", "done")), "เสร็จแล้ว");
});

test("resolveBucket: the five buckets and all pass, anything else is undefined", () => {
  for (const b of ["all", "overdue", "soon", "later", "nodate", "done"]) assert.equal(resolveBucket(b), b);
  for (const b of [undefined, "", "alert", "OVERDUE", "toString", "__proto__", "x"]) assert.equal(resolveBucket(b), undefined);
  assert.equal(resolveBucket(["soon", "done"]), "soon");
  assert.equal(resolveBucket([]), undefined);
});
