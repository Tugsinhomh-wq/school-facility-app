import test from "node:test";
import assert from "node:assert/strict";
import { shortRoomName } from "./room-label.ts";

test("drops the common prefix", () => {
  assert.equal(shortRoomName("ห้องประชุมภูมินทร์"), "ภูมินทร์");
  assert.equal(shortRoomName("ห้องประชุม มหาชนก"), "มหาชนก");
});

test("keeps names without the prefix or only the prefix", () => {
  assert.equal(shortRoomName("หอประชุม"), "หอประชุม");
  assert.equal(shortRoomName("ห้องประชุม"), "ห้องประชุม");
});
