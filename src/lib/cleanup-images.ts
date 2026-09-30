import type { SupabaseClient } from "@supabase/supabase-js";

import { BUCKET } from "@/lib/images";

export interface CleanupResult {
  scanned: number;
  referenced: number;
  tooRecent: number;
  orphans: string[];
  deleted: number;
  dryRun: boolean;
}

const PAGE = 100;

/** Every object path in the bucket. Files live one folder deep: <user id>/<uuid>.jpg. */
async function listAll(supabase: SupabaseClient) {
  const files: { path: string; createdAt: number }[] = [];
  const storage = supabase.storage.from(BUCKET);

  for (let folderOffset = 0; ; folderOffset += PAGE) {
    const { data: folders, error } = await storage.list("", { limit: PAGE, offset: folderOffset });
    if (error) throw error;
    for (const folder of folders) {
      for (let offset = 0; ; offset += PAGE) {
        const { data: items, error: listError } = await storage.list(folder.name, { limit: PAGE, offset });
        if (listError) throw listError;
        for (const item of items) {
          if (item.id) files.push({ path: `${folder.name}/${item.name}`, createdAt: new Date(item.created_at ?? 0).getTime() });
        }
        if (items.length < PAGE) break;
      }
    }
    if (folders.length < PAGE) break;
  }
  return files;
}

/**
 * Deletes photos that no repair ticket points to. A file only counts as abandoned once it is
 * older than `minAgeMinutes`, so a photo uploaded a moment ago for a form still being filled
 * in is never touched. Any failure reading the tickets aborts before deleting anything.
 */
export async function cleanupOrphanImages(supabase: SupabaseClient, opts: { minAgeMinutes: number; dryRun: boolean; maxDelete?: number }): Promise<CleanupResult> {
  const { data: tickets, error } = await supabase.from("repair_tickets").select("image_urls").not("image_urls", "eq", "{}");
  if (error) throw error;
  const referenced = new Set((tickets ?? []).flatMap((t) => (t.image_urls as string[] | null) ?? []));

  const files = await listAll(supabase);
  const cutoff = Date.now() - opts.minAgeMinutes * 60_000;
  const unreferenced = files.filter((f) => !referenced.has(f.path));
  const old = unreferenced.filter((f) => f.createdAt <= cutoff);
  const orphans = old.slice(0, opts.maxDelete ?? 500).map((f) => f.path);

  let deleted = 0;
  if (!opts.dryRun && orphans.length > 0) {
    const { data, error: removeError } = await supabase.storage.from(BUCKET).remove(orphans);
    if (removeError) throw removeError;
    deleted = data?.length ?? 0;
  }

  return { scanned: files.length, referenced: files.length - unreferenced.length, tooRecent: unreferenced.length - old.length, orphans, deleted, dryRun: opts.dryRun };
}
