import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const activeAvatarFiles = [
  "src/server/repositories/profiles.ts",
  "src/features/auth/use-viewer-identity.client.ts",
  "src/components/ui/avatar.tsx",
  "src/app/settings/profile/page.tsx",
  "src/app/[username]/page.tsx",
];

describe("generated-avatar application cutover", () => {
  it("ignores retained legacy pointers and never resolves avatar Storage", () => {
    const source = activeAvatarFiles
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/avatar_path|avatar_version_id/);
    expect(source).not.toContain("getPublicAvatarUrl");
    expect(source).not.toContain("public-avatars");
    expect(source).not.toContain(".storage.");
    expect(source).not.toContain("process-profile-image");
  });

  it("exposes only generated-avatar database contracts after contraction", () => {
    const generatedTypes = readFileSync(
      resolve(process.cwd(), "src/lib/supabase/database.types.ts"),
      "utf8",
    );
    expect(generatedTypes).not.toContain("avatar_path");
    expect(generatedTypes).not.toContain("avatar_version_id");
    expect(generatedTypes).not.toContain("get_admin_storage_summary");
    expect(generatedTypes).toContain("avatar_config");
    expect(generatedTypes).toContain("get_admin_retention_summary");
  });
});
