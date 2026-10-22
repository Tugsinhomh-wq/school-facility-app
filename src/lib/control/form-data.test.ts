import test from "node:test";
import assert from "node:assert/strict";
import { withSubmitter } from "./form-data.ts";

const base = () => {
  const d = new FormData();
  d.append("id", "1");
  return d;
};

test("withSubmitter: a browser that ignored the submitter gets the pressed button added", () => {
  const d = withSubmitter(base(), { name: "intent", value: "confirm" });
  assert.deepEqual(d.getAll("intent"), ["confirm"]);
  assert.equal(d.get("id"), "1");
});

test("withSubmitter: a browser that already added it does not get it twice", () => {
  const d = base();
  d.append("intent", "confirm");
  assert.deepEqual(withSubmitter(d, { name: "intent", value: "confirm" }).getAll("intent"), ["confirm"]);
});

test("withSubmitter: no button, an unnamed button or a disabled one adds nothing", () => {
  for (const s of [null, { name: "", value: "x" }, { name: "intent", value: "x", disabled: true }]) {
    assert.deepEqual([...withSubmitter(base(), s).keys()], ["id"]);
  }
});

test("withSubmitter: another button with the same name but a different value is still added", () => {
  const d = base();
  d.append("intent", "save");
  assert.deepEqual(withSubmitter(d, { name: "intent", value: "confirm" }).getAll("intent"), ["save", "confirm"]);
});
