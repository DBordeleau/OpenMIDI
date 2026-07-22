import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAvatarConfig, DEFAULT_AVATAR_OPTIONS } from "./contract";
import {
  renderAvatarDataUri,
  renderAvatarDataUriFromUnknown,
} from "./renderer";

const config = createAvatarConfig(
  "30000000-0000-4000-8000-000000000001",
  DEFAULT_AVATAR_OPTIONS,
);

describe("local DiceBear renderer", () => {
  it("renders the pinned defaults deterministically as a local data URI", () => {
    if (!config) throw new Error("test config must be valid");
    const first = renderAvatarDataUri(config);
    const second = renderAvatarDataUri(config);
    expect(first).toBe(second);
    expect(first).toMatch(/^data:image\/svg\+xml/);
    expect(createHash("sha256").update(first).digest("hex")).toBe(
      "4b15a56f179727a9d366479d1319bcecd53297a627e638f44f84b17f51133d1a",
    );
  });

  it("changes for meaningful options and rejects malformed database JSON", () => {
    if (!config) throw new Error("test config must be valid");
    const changed = createAvatarConfig(config.seed, {
      ...config.options,
      eyesVariant: "variant26",
    });
    if (!changed) throw new Error("changed test config must be valid");
    expect(renderAvatarDataUri(changed)).not.toBe(renderAvatarDataUri(config));
    expect(
      renderAvatarDataUriFromUnknown({ ...config, version: 2 }),
    ).toBeNull();
  });
});
