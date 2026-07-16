import { sha256PostgresJsonb } from "@/features/studio/manifest/canonical-json";
import {
  canonicalizeStemContent,
  type MidiStemDraftV1,
  type MidiStemVersionV1,
} from "@/features/studio/manifest/v2";

type StemContent = Pick<
  MidiStemDraftV1 | MidiStemVersionV1,
  | "name"
  | "defaultPresetId"
  | "defaultPresetVersion"
  | "ppq"
  | "durationTicks"
  | "notes"
>;

export async function sha256MidiStemContent(
  stem: StemContent,
): Promise<string> {
  const canonical = canonicalizeStemContent({
    ...stem,
    draftId: "00000000-0000-4000-8000-000000000000",
    stemId: "00000000-0000-4000-8000-000000000000",
    ownerId: "00000000-0000-4000-8000-000000000000",
    parentStemVersionId: null,
    lockVersion: 0,
  });
  return sha256PostgresJsonb({
    name: canonical.name,
    defaultPresetId: canonical.defaultPresetId,
    defaultPresetVersion: canonical.defaultPresetVersion,
    ppq: canonical.ppq,
    durationTicks: canonical.durationTicks,
    notes: canonical.notes,
  });
}
