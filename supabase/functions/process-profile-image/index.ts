import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  MagickGeometry,
} from "@imagemagick/magick-wasm";
import { createClient } from "@supabase/supabase-js";

import { edgeCorsHeaders, edgeCorsPreflightResponse } from "../_shared/cors.ts";
import {
  detectProfileImageSignature,
  MAX_PROFILE_AVATAR_BYTES,
  MAX_PROFILE_IMAGE_BYTES,
  PermanentProfileImageError,
  profileImageSha256,
  validateProfileImageMetadata,
} from "../_shared/profile-image.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const wasmBytes = await Deno.readFile(
  new URL("magick.wasm", import.meta.resolve("@imagemagick/magick-wasm")),
);
await initializeImageMagick(wasmBytes);

type Claim = {
  asset_id: string;
  owner_id: string;
  avatar_version_id: string;
  bucket: string;
  object_path: string;
  reserved_byte_size: number;
  declared_media_type: string;
  public_object_path: string;
  lease_token: string;
  attempt_count: number;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, { headers: edgeCorsHeaders, status });
}

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

function event(name: string, claim?: Claim) {
  console.log(
    JSON.stringify({
      event: name,
      assetId: claim?.asset_id,
      attempt: claim?.attempt_count,
    }),
  );
}

async function retry(
  serviceClient: ReturnType<typeof createClient>,
  claim: Claim,
  code: string,
) {
  await serviceClient.rpc("operator_retry_profile_image", {
    p_asset_id: claim.asset_id,
    p_lease_token: claim.lease_token,
    p_error_code: code,
  });
  event("profile_image_retry_scheduled", claim);
}

async function processClaim(
  serviceClient: ReturnType<typeof createClient>,
  claim: Claim,
) {
  try {
    const { data: blob, error } = await serviceClient.storage
      .from(claim.bucket)
      .download(claim.object_path);
    if (error || !blob) return retry(serviceClient, claim, "download_failed");
    if (
      blob.size > MAX_PROFILE_IMAGE_BYTES ||
      blob.size !== Number(claim.reserved_byte_size)
    )
      throw new PermanentProfileImageError("size_mismatch");

    const sourceBuffer = await blob.arrayBuffer();
    const sourceBytes = new Uint8Array(sourceBuffer);
    const signature = detectProfileImageSignature(sourceBytes.slice(0, 16));
    let width = 0;
    let height = 0;
    let frameCount = 0;
    let output: Uint8Array;
    try {
      output = ImageMagick.readCollection(sourceBytes, (images) => {
        frameCount = images.length;
        const image = images[0];
        if (!image) throw new Error("missing_frame");
        image.autoOrient();
        width = image.width;
        height = image.height;
        validateProfileImageMetadata({
          signatureMediaType: signature,
          declaredMediaType: claim.declared_media_type,
          width,
          height,
          frameCount,
        });
        const size = Math.min(width, height);
        image.crop(
          new MagickGeometry(
            Math.floor((width - size) / 2),
            Math.floor((height - size) / 2),
            size,
            size,
          ),
        );
        image.resize(512, 512);
        image.strip();
        image.quality = 82;
        return image.write(MagickFormat.WebP, (data) => data);
      });
    } catch (cause) {
      if (cause instanceof PermanentProfileImageError) throw cause;
      throw new PermanentProfileImageError("unreadable_image");
    }
    if (output.byteLength < 1 || output.byteLength > MAX_PROFILE_AVATAR_BYTES)
      throw new PermanentProfileImageError("derivative_too_large");

    const { error: uploadError } = await serviceClient.storage
      .from("public-avatars")
      .upload(claim.public_object_path, output, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError && !uploadError.message.toLowerCase().includes("exist"))
      return retry(serviceClient, claim, "derivative_upload_failed");

    const [sourceHash, outputHash] = await Promise.all([
      profileImageSha256(sourceBuffer),
      profileImageSha256(output.buffer as ArrayBuffer),
    ]);
    const { error: completeError } = await serviceClient.rpc(
      "operator_complete_profile_image",
      {
        p_asset_id: claim.asset_id,
        p_lease_token: claim.lease_token,
        p_media_type: signature,
        p_byte_size: sourceBytes.byteLength,
        p_sha256: sourceHash,
        p_width: width,
        p_height: height,
        p_frame_count: frameCount,
        p_output_byte_size: output.byteLength,
        p_output_sha256: outputHash,
      },
    );
    if (completeError) return retry(serviceClient, claim, "finalize_failed");
    event("profile_image_succeeded", claim);
  } catch (error) {
    const code =
      error instanceof PermanentProfileImageError ? error.code : "worker_error";
    await retry(serviceClient, claim, code);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return edgeCorsPreflightResponse();
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const recoverySecret = Deno.env.get("PROFILE_IMAGE_RECOVERY_SECRET");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !recoverySecret)
    return json({ error: "worker_not_configured" }, 503);

  const token = bearerToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);
  let body: { assetId?: unknown; mode?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const isRecovery =
    body.mode === "recover" &&
    request.headers.get("x-profile-image-recovery-secret") === recoverySecret;
  let assetId: string | null = null;
  let ownerId: string | null = null;
  if (!isRecovery) {
    if (typeof body.assetId !== "string" || !uuidPattern.test(body.assetId))
      return json({ error: "invalid_asset" }, 400);
    assetId = body.assetId;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } =
      await userClient.auth.getUser(token);
    if (userError || !userData.user)
      return json({ error: "unauthorized" }, 401);
    ownerId = userData.user.id;
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await serviceClient.rpc(
    "operator_claim_profile_image",
    { p_asset_id: assetId, p_owner_id: ownerId },
  );
  if (error) return json({ error: "claim_failed" }, 503);
  const claim = (data?.[0] ?? null) as Claim | null;
  if (!claim) return json({ accepted: true, claimed: false }, 202);
  event("profile_image_accepted", claim);
  EdgeRuntime.waitUntil(processClaim(serviceClient, claim));
  return json({ accepted: true, claimed: true }, 202);
});
