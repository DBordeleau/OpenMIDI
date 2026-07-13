import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const sampleRate = 44_100;
const durationSeconds = 2;

function makeWav(sampleAt) {
  const sampleCount = sampleRate * durationSeconds;
  const dataSize = sampleCount * 2;
  const output = Buffer.alloc(44 + dataSize);
  output.write("RIFF", 0);
  output.writeUInt32LE(36 + dataSize, 4);
  output.write("WAVEfmt ", 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const value = Math.max(-1, Math.min(1, sampleAt(index / sampleRate)));
    output.writeInt16LE(Math.round(value * 32_767), 44 + index * 2);
  }
  return output;
}

const fixtures = [
  [
    "stem-a.wav",
    (time) =>
      0.28 *
      Math.sin(2 * Math.PI * 220 * time) *
      (0.6 + 0.4 * Math.sin(2 * Math.PI * 2 * time)),
  ],
  [
    "stem-b.wav",
    (time) =>
      0.22 * Math.sin(2 * Math.PI * 440 * time) * Math.exp(-2.2 * (time % 0.5)),
  ],
];

for (const [name, sampleAt] of fixtures) {
  const target = resolve("public", "fixtures", "audio", name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, makeWav(sampleAt));
}
