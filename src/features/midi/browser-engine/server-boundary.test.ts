import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("MIDI browser engine boundary", () => {
  it("keeps Tone and local rendering out of server-owned modules", () => {
    const roots = ["src/server", "src/app"];
    const forbiddenImports = [
      /from ["']tone["']/,
      /import\(["']tone["']\)/,
      /preset-voice\.client/,
      /project-export\.client/,
    ];
    const files = roots.flatMap((root) =>
      sourceFiles(path.join(process.cwd(), root)),
    );

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const forbidden of forbiddenImports) {
        expect(source, `${file} imports browser-only MIDI audio`).not.toMatch(
          forbidden,
        );
      }
    }
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}
