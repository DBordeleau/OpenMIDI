import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MidiLibraryListingManager } from "./listing-manager.client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  listMidiLibraryAction: vi.fn(),
  unlistMidiLibraryAction: vi.fn(),
}));
const options = {
  categories: [{ code: "melody", name: "Melody" }],
  tags: [{ code: "melodic", name: "Melodic" }],
  presets: [{ id: "warm-keys", version: 1, name: "Warm keys", family: "keys" }],
};
const version = {
  patternId: "10000000-0000-4000-8000-000000000001",
  patternName: "Night phrase",
  patternVersionId: "10000000-0000-4000-8000-000000000002",
  versionNumber: 1,
  createdAt: "2026-07-17T20:00:00.000Z",
  reuseLicenseCode: "CC-BY-4.0",
  durationTicks: 1920,
  noteCount: 4,
  hasSourceLineage: false,
  hasInheritedExternalCredits: false,
  activeListingId: null,
  activeListingPatternVersionId: null,
  activeReuseMode: null,
  activeCreatorVersion: null,
};
describe("creator listing workflow", () => {
  afterEach(cleanup);
  it("prevents a CC BY downgrade and blocks uncertain-rights publication", () => {
    render(
      <MidiLibraryListingManager versions={[version]} options={options} />,
    );
    expect(
      screen.getByRole("radio", { name: /Reference only/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Cover, recreation/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "cannot enter either public mode",
    );
    expect(
      screen.getByRole("button", { name: "Publish listing" }),
    ).toBeDisabled();
  });
  it("keeps the credit-is-not-permission notice visible", () => {
    render(
      <MidiLibraryListingManager versions={[version]} options={options} />,
    );
    expect(screen.getByText(/Credit acknowledges a source/)).toBeVisible();
  });
  it("locks derived patterns to adaptation rights and inherited credits", () => {
    render(
      <MidiLibraryListingManager
        versions={[
          {
            ...version,
            hasSourceLineage: true,
            hasInheritedExternalCredits: true,
          },
        ]}
        options={options}
      />,
    );
    expect(
      screen.getByText(/inherited external credits will be carried/i),
    ).toBeVisible();
    expect(
      screen.getByRole("radio", { name: /Wholly original/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: /Authorized adaptation/ }),
    ).toBeChecked();
  });
});
