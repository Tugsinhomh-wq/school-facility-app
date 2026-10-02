import "server-only";

import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Tables worth keeping, parents before children (the restore script relies on this order). */
export const BACKUP_TABLES = [
  "buildings",
  "rooms",
  "profiles",
  "repair_tickets",
  "facility_reservations",
  "memorandums",
  "approval_records",
  "environment_inspections",
  "feedback",
] as const;

const PAGE = 1000;
const MAGIC = Buffer.from("LRPBK1");

export async function dumpTables(supabase: SupabaseClient) {
  const tables: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      // A stable order keeps pages from skipping or repeating rows while people use the system.
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`backup: ${table}: ${error.message}`);
      rows.push(...data);
      if (data.length < PAGE) break;
    }
    tables[table] = rows;
  }
  return { version: 1, createdAt: new Date().toISOString(), tables };
}

/** gzip, then AES-256-GCM. File layout: "LRPBK1" | iv(12) | tag(16) | ciphertext. */
export function encryptBackup(payload: unknown, keyHex: string) {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32)
    throw new Error(
      "BACKUP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)",
    );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([
    cipher.update(gzipSync(JSON.stringify(payload))),
    cipher.final(),
  ]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

export const checksum = (data: Buffer) =>
  createHash("sha256").update(data).digest("hex");

// --- Google Drive (OAuth refresh token of a school account: the file counts against that account's space) ---

async function accessToken() {
  const {
    GOOGLE_OAUTH_CLIENT_ID: id,
    GOOGLE_OAUTH_CLIENT_SECRET: secret,
    GOOGLE_OAUTH_REFRESH_TOKEN: refresh,
  } = process.env;
  if (!id || !secret || !refresh)
    throw new Error("Google Drive credentials are not set");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token)
    throw new Error(`Google token refused: ${json.error ?? res.status}`);
  return json.access_token;
}

export async function uploadToDrive(
  name: string,
  data: Buffer,
  folderId: string,
) {
  const token = await accessToken();
  const boundary = `lrp${randomBytes(8).toString("hex")}`;
  const meta = JSON.stringify({ name, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok)
    throw new Error(
      `Drive upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
    );
  return (await res.json()) as { id: string; name: string; size: string };
}

/** Deletes backups in the folder older than `keepDays`, always keeping the newest `minKeep`. */
export async function pruneDrive(
  folderId: string,
  keepDays: number,
  minKeep: number,
) {
  const token = await accessToken();
  const q = encodeURIComponent(
    `'${folderId}' in parents and name contains 'lrp-backup-' and trashed=false`,
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=200&fields=files(id,name,createdTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const { files } = (await res.json()) as {
    files: { id: string; name: string; createdTime: string }[];
  };
  const cutoff = Date.now() - keepDays * 86_400_000;
  const old = files
    .slice(minKeep)
    .filter((f) => new Date(f.createdTime).getTime() < cutoff);
  for (const f of old) {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${f.id}?supportsAllDrives=true`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
  }
  return old.length;
}
