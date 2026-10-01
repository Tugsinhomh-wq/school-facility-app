import { spawn } from "node:child_process";
import path from "node:path";

import type { MemoDoc } from "@/lib/memo/model";

const GARUDA = path.join(/* turbopackIgnore: true */ process.cwd(), "src/lib/memo/assets/garuda.png");

// The scripts folder is read at request time only by the child process, not imported.
const SCRIPT_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "scripts");

/**
 * Builds the Word file with the thai-docx approach (python-docx + pythainlp word breaks).
 * Needs Python with `pip install -r scripts/requirements.txt`; rejects if it is not available
 * so the caller can fall back.
 */
export function memoToDocxPython(doc: MemoDoc, timeoutMs = 30_000): Promise<Buffer> {
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
    child.stdin.end(JSON.stringify({ ...doc, garuda: GARUDA }));
  });
}
