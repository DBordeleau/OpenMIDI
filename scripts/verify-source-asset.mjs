import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { parseBuffer } from "music-metadata";

const id = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!id || !url || !key)
  throw new Error(
    "Usage: npm run assets:verify -- <asset-uuid>; NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: asset, error } = await db
  .from("assets")
  .select("id,bucket,object_path,reserved_byte_size,status,original_filename")
  .eq("id", id)
  .single();
if (error || asset.status !== "processing")
  throw new Error("Asset is unavailable or not processing.");
try {
  const { data, error: downloadError } = await db.storage
    .from(asset.bucket)
    .download(asset.object_path);
  if (downloadError) throw downloadError;
  if (
    data.size > 45 * 1024 * 1024 ||
    data.size !== Number(asset.reserved_byte_size)
  )
    throw new Error("size_mismatch");
  const bytes = Buffer.from(await data.arrayBuffer());
  const metadata = await parseBuffer(
    bytes,
    { mimeType: data.type, path: asset.original_filename },
    { duration: true, skipCovers: true },
  );
  const format = metadata.format;
  const mime = format.container?.toLowerCase().includes("flac")
    ? "audio/flac"
    : format.container?.toLowerCase().includes("mpeg")
      ? "audio/mpeg"
      : format.container?.toLowerCase().includes("wave")
        ? "audio/wav"
        : null;
  const duration = Math.round((format.duration ?? 0) * 1000);
  const rate = format.sampleRate ?? 0;
  const channels = format.numberOfChannels ?? 0;
  if (!mime) throw new Error("unsupported_format");
  if (duration < 1 || duration > 600000) throw new Error("duration_exceeded");
  if (rate < 8000 || rate > 192000) throw new Error("sample_rate_exceeded");
  if (channels < 1 || channels > 8) throw new Error("channels_exceeded");
  const { error: promoteError } = await db.rpc(
    "operator_promote_source_asset",
    {
      p_asset_id: id,
      p_media_type: mime,
      p_byte_size: bytes.length,
      p_sha256: createHash("sha256").update(bytes).digest("hex"),
      p_duration_ms: duration,
      p_sample_rate_hz: rate,
      p_channels: channels,
      p_verification_version: "source-audio-v1",
    },
  );
  if (promoteError) throw promoteError;
  console.log(`Verified ${id} as ${mime} (${bytes.length} bytes).`);
} catch (error) {
  const code =
    error instanceof Error && /^[a-z_]+$/.test(error.message)
      ? error.message
      : "verification_error";
  await db.rpc("operator_fail_source_asset", {
    p_asset_id: id,
    p_failure_code: code,
  });
  throw new Error(`Verification failed: ${code}`);
}
