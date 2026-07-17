import type { MidiStemVersionV1 } from "../manifest/v2";
import type { ManifestV3 } from "../manifest/v3";
import {
  exportMidiProject,
  renderMidiProjectWav,
} from "@/features/midi/project-export.client";
import { toEditorManifest } from "./manifest-v3-editor";

export function exportStudioMidiV3(
  manifest: ManifestV3,
  patternVersions: ReadonlyMap<string, MidiStemVersionV1>,
  projectTitle: string,
) {
  return exportMidiProject(
    toEditorManifest(manifest),
    patternVersions,
    projectTitle,
  );
}

export function renderStudioWavV3(
  manifest: ManifestV3,
  patternVersions: ReadonlyMap<string, MidiStemVersionV1>,
) {
  return renderMidiProjectWav(
    toEditorManifest(manifest),
    patternVersions,
    manifest.engineVersion,
  );
}
