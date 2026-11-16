import test from "node:test";
import assert from "node:assert/strict";

import { makeJpegHeader, makePng } from "./test-images.ts";
import { fitWithin, imageSize, loadPhotoFiles, PHOTO_BOX_CM, PHOTO_LIMIT } from "./photo-files.ts";

const okResponse = (body: Buffer) => ({ ok: true, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) }) as unknown as Response;

test("imageSize reads a PNG and a JPEG header and nothing else", () => {
  assert.deepEqual(imageSize(makePng(30, 20)), { width: 30, height: 20, type: "png" });
  assert.deepEqual(imageSize(makeJpegHeader(40, 60)), { width: 40, height: 60, type: "jpg" });
  assert.equal(imageSize(Buffer.from("not an image at all")), null);
  assert.equal(imageSize(Buffer.alloc(0)), null);
  assert.equal(imageSize(makePng(30, 20).subarray(0, 12)), null);
});

test("fitWithin keeps the proportions and stays inside the box", () => {
  const { width: bw, height: bh } = PHOTO_BOX_CM;
  const tall = fitWithin(3000, 4000, bw, bh);
  assert.ok(tall.height <= bh + 1e-9 && tall.width <= bw + 1e-9);
  assert.ok(Math.abs(tall.width / tall.height - 0.75) < 1e-9);
  const wide = fitWithin(4000, 1000, bw, bh);
  assert.ok(Math.abs(wide.width - bw) < 1e-9);
  assert.ok(Math.abs(wide.width / wide.height - 4) < 1e-9);
  const sliver = fitWithin(100, 9000, bw, bh);
  assert.ok(sliver.height <= bh + 1e-9 && sliver.width > 0);
});

test("loadPhotoFiles keeps the order and turns every kind of failure into a placeholder, never a throw", async () => {
  const good = makePng(30, 20);
  const bodies: Record<string, () => Promise<Response>> = {
    "https://x/ok": async () => okResponse(good),
    "https://x/http": async () => ({ ok: false }) as Response,
    "https://x/throws": async () => {
      throw new Error("network down");
    },
    "https://x/text": async () => okResponse(Buffer.from("<html>sign in</html>")),
  };
  const { groups, omitted } = await loadPhotoFiles(
    [
      { heading: "A", urls: ["https://x/ok", "https://x/http", ""] },
      { heading: "B", urls: ["https://x/throws", "https://x/text", "https://x/ok"] },
    ],
    (url) => bodies[String(url)](),
  );
  assert.equal(omitted, 0);
  assert.deepEqual(groups.map((g) => g.heading), ["A", "B"]);
  const kinds = groups.map((g) => g.photos.map((p) => ("failed" in p ? "failed" : `${p.width}x${p.height}`)));
  assert.deepEqual(kinds, [["30x20", "failed", "failed"], ["failed", "failed", "30x20"]]);
});

test("loadPhotoFiles stops at the photo limit and says how many were left out", async () => {
  let calls = 0;
  const png = makePng(4, 4);
  const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://x/${i}`);
  const { groups, omitted } = await loadPhotoFiles(
    [
      { heading: "A", urls: urls(50) },
      { heading: "B", urls: urls(35) },
    ],
    async () => {
      calls++;
      return okResponse(png);
    },
  );
  assert.equal(PHOTO_LIMIT, 80);
  assert.equal(groups.reduce((n, g) => n + g.photos.length, 0), 80);
  assert.equal(omitted, 5);
  assert.equal(calls, 80);
});

test("loadPhotoFiles has at most 6 downloads in flight", async () => {
  let inFlight = 0;
  let peak = 0;
  const png = makePng(4, 4);
  await loadPhotoFiles([{ heading: "", urls: Array.from({ length: 30 }, (_, i) => `https://x/${i}`) }], async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return okResponse(png);
  });
  assert.ok(peak <= 6 && peak > 1, `peak was ${peak}`);
});
