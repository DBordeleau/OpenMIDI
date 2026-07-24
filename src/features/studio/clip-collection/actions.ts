"use server";

import {
  getStudioClipDetailInputSchema,
  importStudioClipInputSchema,
  listStudioClipCollectionInputSchema,
  type ImportStudioClipResult,
  type StudioClipCollection,
  type StudioClipDetail,
} from "./schema";
import {
  getStudioClipDetail,
  importStudioClip,
  listStudioClipCollection,
  StudioClipRepositoryError,
  type StudioClipRepositoryFailure,
} from "@/server/repositories/studio-clip-collection";

type Failure = { ok: false; code: StudioClipRepositoryFailure };
export type StudioClipFailureCode = StudioClipRepositoryFailure;

function failure(error: unknown): Failure {
  return {
    ok: false,
    code:
      error instanceof StudioClipRepositoryError ? error.reason : "unavailable",
  };
}

export async function listStudioClipCollectionAction(
  input: unknown,
): Promise<{ ok: true; collection: StudioClipCollection } | Failure> {
  const parsed = listStudioClipCollectionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_request" };
  try {
    return {
      ok: true,
      collection: await listStudioClipCollection(parsed.data),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function getStudioClipDetailAction(
  input: unknown,
): Promise<{ ok: true; detail: StudioClipDetail } | Failure> {
  const parsed = getStudioClipDetailInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_request" };
  try {
    return {
      ok: true,
      detail: await getStudioClipDetail(parsed.data.patternVersionId),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function importStudioClipAction(
  input: unknown,
): Promise<{ ok: true; result: ImportStudioClipResult } | Failure> {
  const parsed = importStudioClipInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_request" };
  try {
    return { ok: true, result: await importStudioClip(parsed.data) };
  } catch (error) {
    return failure(error);
  }
}
