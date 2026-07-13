"use server";
import { revalidatePath } from "next/cache";
import { sourceReservationSchema } from "./schema";
import {
  cancelSourceAsset,
  completeSourceAsset,
  reserveSourceAsset,
} from "@/server/repositories/assets";

export async function reserveUpload(input: unknown) {
  const parsed = sourceReservationSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid upload details." };
  const { data, error } = await reserveSourceAsset(parsed.data);
  if (error || !data?.[0])
    return { error: error?.message ?? "Could not reserve storage." };
  const row = data[0] as Record<string, unknown>;
  return {
    instruction: {
      assetId: String(row.asset_id),
      bucket: String(row.bucket),
      objectPath: String(row.object_path),
      expiresAt: String(row.expires_at),
      capacityWarning: Boolean(row.capacity_warning),
    },
  };
}
export async function completeUpload(assetId: string) {
  const { error } = await completeSourceAsset(assetId);
  if (error) return { error: error.message };
  revalidatePath("/uploads");
  return { ok: true };
}
export async function cancelUpload(assetId: string) {
  const { error } = await cancelSourceAsset(assetId);
  if (error) return { error: error.message };
  revalidatePath("/uploads");
  return { ok: true };
}
