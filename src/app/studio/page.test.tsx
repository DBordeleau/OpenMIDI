import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudioStartPage from "./page";
import { requireViewer } from "@/features/auth/guards";

vi.mock("@/features/auth/guards", () => ({ requireViewer: vi.fn() }));

describe("Studio start center", () => {
  it("authorizes the canonical destination and offers project directions", async () => {
    render(await StudioStartPage());

    expect(requireViewer).toHaveBeenCalledWith("/studio");
    expect(
      screen.getByRole("heading", {
        name: "Open the music you want to shape.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
    expect(screen.getByRole("link", { name: "Open project" })).toHaveAttribute(
      "href",
      "/projects",
    );
  });

  it("keeps the empty route outside the editor and browser-audio graph", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "app", "studio", "page.tsx"),
      "utf8",
    );

    for (const forbidden of [
      "StudioLauncher",
      "next/dynamic",
      "audio-sources",
      "AudioContext",
      "waveform-playlist",
      "tone",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
