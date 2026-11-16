import { spawn } from "node:child_process";
import path from "node:path";

import type { MemoDoc } from "@/lib/memo/model";
import type { MemoPhotoPages } from "@/lib/memo/photo-files";

const GARUDA = path.join(/* turbopackIgnore: true */ process.cwd(), "src/lib/memo/assets/garuda.png");

// The scripts folder is read at request time only by the child process, not imported.
const SCRIPT_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "scripts");

/**
 * Builds the Word file with the thai-docx approach (python-docx, Sarabun embedded).
 * Needs Python with `pip install -r scripts/requirements.txt`; rejects if it is not available
 * so the caller can fall back.
 */
export function memoToDocxPython(doc: MemoDoc, photos?: MemoPhotoPages, timeoutMs = 30_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(/* turbopackIgnore: true */ process.env.PYTHON_BIN || "python3", [/* turbopackIgnore: true */ path.join(SCRIPT_DIR, "memo_docx.py")], {
      cwd: /* turbopackIgnore: true */ SCRIPT_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("memo_docx.py timed out"));
    }, timeoutMs);

    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => err.push(c));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`memo_docx.py exited ${code}: ${Buffer.concat(err).toString().slice(-500)}`));
    });
    child.stdin.on("error", () => {}); // a failed spawn surfaces through "error"/"close"
    // Photos travel as base64 in the same JSON; without any, the key is left out.
    const withPhotos =
      photos && photos.groups.length > 0
        ? {
            groups: photos.groups.map((g) => ({
              heading: g.heading,
              photos: g.photos.map((p) => ("failed" in p ? p : { data: p.data.toString("base64"), width: p.width, height: p.height })),
            })),
            omitted: photos.omitted,
          }
        : undefined;
    child.stdin.end(JSON.stringify({ ...doc, garuda: GARUDA, photos: withPhotos }));
  });
}
