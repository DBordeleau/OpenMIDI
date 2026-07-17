import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudioStartPage from "./page";
import { requireViewer } from "@/features/auth/guards";

vi.mock("@/features/auth/guards", () => ({ requireViewer: vi.fn() }));

describe("blank Studio start state", () => {
  it("authorizes the canonical destination and renders a useful blank arranger", async () => {
    render(await StudioStartPage());

    expect(requireViewer).toHaveBeenCalledWith("/studio");
    expect(
      screen.getByRole("region", { name: "Blank arrangement workspace" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "No project open" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Play arrangement" }),
    ).toBeDisabled();
    expect(
      screen.getByText("This blank arrangement is not saved."),
    ).toBeVisible();
    expect(screen.getByLabelText("Arrangement ruler")).toBeVisible();
  });

  it("keeps the empty route outside the editor and browser-audio graph", () => {
    const sources = [
      path.join(process.cwd(), "src", "app", "studio", "page.tsx"),
      path.join(
        process.cwd(),
        "src",
        "features",
        "studio",
        "components",
        "blank-studio-workspace.tsx",
      ),
    ].map((file) => readFileSync(file, "utf8"));

    for (const forbidden of [
      "StudioLauncher",
      "next/dynamic",
      "AudioContext",
      "tone",
    ]) {
      for (const source of sources) expect(source).not.toContain(forbidden);
    }
  });
});
