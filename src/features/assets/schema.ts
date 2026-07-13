import { z } from "zod";

export const MAX_SOURCE_BYTES = 45 * 1024 * 1024;
export const sourceReservationSchema = z.object({
  requestId: z.uuid(),
  byteSize: z.number().int().min(1).max(MAX_SOURCE_BYTES),
  filename: z.string().trim().min(1).max(255),
  mediaType: z.string().trim().max(100).nullable(),
  durationMs: z.number().int().min(1).max(600_000).nullable(),
});

export async function preflightSourceFile(file: File) {
  if (!file.size || file.size > MAX_SOURCE_BYTES)
    throw new Error("Choose a file between 1 byte and 45 MiB.");
  const extension = file.name.toLowerCase().match(/\.(wav|flac|mp3)$/)?.[1];
  if (!extension) throw new Error("Choose a WAV, FLAC, or MP3 file.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = String.fromCharCode(...bytes);
  const wav =
    extension === "wav" &&
    ascii.startsWith("RIFF") &&
    ascii.slice(8, 12) === "WAVE";
  const flac = extension === "flac" && ascii.startsWith("fLaC");
  const mp3 =
    extension === "mp3" &&
    (ascii.startsWith("ID3") ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
  if (!wav && !flac && !mp3)
    throw new Error("The file header does not match its extension.");
  return {
    byteSize: file.size,
    filename: file.name.trim(),
    mediaType: file.type || null,
    durationMs: null,
  };
}
