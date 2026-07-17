import { Midi } from "@tonejs/midi";
import { MIDI_V3_REUSE_LICENSE } from "@/features/midi/domain-v3";
import { sanitizeFilenamePart } from "@/features/exports/filename";
import type { PublicMidiRevision } from "./contract";
import { schedulePublicMidiRevision } from "./schedule";

type ZipEntry = { name: string; bytes: Uint8Array };

export function createLicensedMidiExport(revision: PublicMidiRevision) {
  if (
    revision.license.code !== "cc-by-4.0" ||
    revision.license.url !== MIDI_V3_REUSE_LICENSE.url
  ) {
    throw new Error("public_midi_export_requires_cc_by_4_0");
  }
  const patterns = new Map(
    revision.patternVersions.map((pattern) => [
      pattern.midiPatternVersionId,
      pattern,
    ]),
  );
  const events = schedulePublicMidiRevision(revision.manifest, patterns);
  const midi = new Midi();
  midi.header.fromJSON({
    name: revision.projectTitle,
    ppq: revision.manifest.ppq,
    tempos: [{ bpm: revision.manifest.tempoBpm, ticks: 0 }],
    timeSignatures: [
      {
        ticks: 0,
        timeSignature: [
          revision.manifest.timeSignature.numerator,
          revision.manifest.timeSignature.denominator,
        ],
      },
    ],
    keySignatures: [],
    meta: [
      {
        ticks: 0,
        type: "text" as const,
        text: `Attribution and ${MIDI_V3_REUSE_LICENSE.code} terms are included beside this MIDI file.`,
      },
    ],
  });
  for (const arrangementTrack of revision.manifest.tracks) {
    const track = midi.addTrack();
    track.name = arrangementTrack.name;
    for (const event of events.filter(
      ({ trackId }) => trackId === arrangementTrack.trackId,
    )) {
      track.addNote({
        midi: event.pitch,
        velocity: event.velocity / 127,
        ticks: event.startTick,
        durationTicks: event.endTick - event.startTick,
      });
    }
    track.endOfTrackTicks = revision.manifest.durationTicks;
  }
  const attribution = {
    schemaVersion: 1,
    project: {
      id: revision.projectId,
      title: revision.projectTitle,
      revisionId: revision.revisionId,
      revisionNumber: revision.revisionNumber,
    },
    revisionAttributions: revision.attributions,
    midiPatterns: revision.patternVersions
      .map((pattern) => ({
        midiPatternId: pattern.midiPatternId,
        midiPatternVersionId: pattern.midiPatternVersionId,
        version: pattern.version,
        creatorId: pattern.creatorId,
        creatorCreditName: pattern.creatorCreditName,
        parentMidiPatternVersionId: pattern.parentMidiPatternVersionId,
        sourceMidiPatternVersionId: pattern.sourceMidiPatternVersionId,
        contentSha256: pattern.contentSha256,
        reuseLicense: pattern.reuseLicense,
      }))
      .sort((left, right) =>
        left.midiPatternVersionId.localeCompare(right.midiPatternVersionId),
      ),
    license: {
      code: revision.license.code,
      name: revision.license.name,
      version: MIDI_V3_REUSE_LICENSE.version,
      url: revision.license.url,
    },
  };
  const encoder = new TextEncoder();
  const base = `${sanitizeFilenamePart(revision.projectTitle, "jam-session-midi")}-revision-${revision.revisionNumber}`;
  const bytes = createStoredZip([
    { name: `${base}.mid`, bytes: midi.toArray() },
    {
      name: "ATTRIBUTION.json",
      bytes: encoder.encode(`${JSON.stringify(attribution, null, 2)}\n`),
    },
    {
      name: "LICENSE.txt",
      bytes: encoder.encode(
        [
          "Creative Commons Attribution 4.0 International (CC BY 4.0)",
          "",
          `License: ${MIDI_V3_REUSE_LICENSE.url}`,
          "",
          "You may share and adapt this material for any purpose when you give appropriate credit, provide the license link, and indicate changes.",
          "Use ATTRIBUTION.json for the immutable project, revision, pattern creator, and source-lineage credits included with this export.",
          "",
        ].join("\n"),
      ),
    },
  ]);
  return { bytes, filename: `${base}-licensed.zip`, attribution };
}

function createStoredZip(entries: ZipEntry[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length + entry.bytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.bytes.length, true);
    localView.setUint32(22, entry.bytes.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(entry.bytes, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.bytes.length, true);
    centralView.setUint32(24, entry.bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return concatenateBytes([...localParts, ...centralParts, end]);
}

function concatenateBytes(parts: Uint8Array[]) {
  const output = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
