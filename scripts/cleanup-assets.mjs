import { createClient } from "@supabase/supabase-js";
const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
const db = createClient(url, key, { auth: { persistSession: false } });
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data, error } = await db
  .from("assets")
  .select("id,bucket,object_path,status,failed_at")
  .eq("status", "failed")
  .lt("failed_at", cutoff)
  .limit(100);
if (error) throw error;
console.log(
  `${dryRun ? "Would remove" : "Removing"} ${data.length} failed source object(s).`,
);
if (!dryRun) {
  for (const asset of data) {
    const result = await db.storage
      .from(asset.bucket)
      .remove([asset.object_path]);
    if (result.error) throw result.error;
  }
}
