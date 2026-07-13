"use server";
import { revalidatePath } from "next/cache";
import { confirmAssetCreditsSchema, sourceReservationSchema } from "./schema";
import {
  cancelSourceAsset,
  completeSourceAsset,
  reserveSourceAsset,
  retrySourceAssetVerification,
  confirmSourceAssetCredits,
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
  const { error, kickDelayed } = await completeSourceAsset(assetId);
  if (error) return { error: error.message };
  revalidatePath("/uploads");
  return { ok: true, kickDelayed };
}

export async function retryVerification(assetId: string) {
  const parsed = sourceReservationSchema.shape.requestId.safeParse(assetId);
  if (!parsed.success) return { error: "Invalid asset." };
  const { error, kickDelayed } = await retrySourceAssetVerification(assetId);
  if (error) return { error: error.message };
  revalidatePath("/uploads");
  return { ok: true, kickDelayed };
}
export async function cancelUpload(assetId: string) {
  const { error } = await cancelSourceAsset(assetId);
  if (error) return { error: error.message };
  revalidatePath("/uploads");
  return { ok: true };
}

export async function confirmAssetCredits(input: unknown) {
  const parsed = confirmAssetCreditsSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid credit details.",
    };
  const { error } = await confirmSourceAssetCredits(parsed.data);
  if (error) {
    const messages: Record<string, string> = {
      asset_credits_already_confirmed: "Credits were already confirmed.",
      asset_credits_already_referenced:
        "This source is already in project history.",
      asset_credit_duplicate_or_creator_missing:
        "Add a creator and remove duplicate name/role pairs.",
    };
    return { error: messages[error.message] ?? "Could not confirm credits." };
  }
  revalidatePath("/uploads");
  return { ok: true };
}
