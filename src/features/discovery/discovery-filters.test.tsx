import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DiscoveryFilters } from "./discovery-filters";
import type { DiscoveryFilters as Filters } from "./types";

const baseFilters: Filters = {
  query: null,
  genres: [],
  tags: [],
  instruments: [],
  keys: [],
  bpmMin: null,
  bpmMax: null,
  openOnly: false,
  sort: "recent",
  after: null,
};

const options = {
  genres: [{ id: "genre-1", slug: "ambient", name: "Ambient" }],
  tags: [{ id: "tag-1", slug: "melodic", name: "Melodic" }],
  instruments: [{ id: "instrument-1", slug: "warm-pad", name: "Warm pad" }],
};

afterEach(cleanup);

describe("DiscoveryFilters", () => {
  it("keeps the taxonomy filters collapsed for an unfiltered search", () => {
    render(<DiscoveryFilters filters={baseFilters} options={options} />);

    expect(screen.getByLabelText("Search projects")).toHaveValue("");
    expect(screen.getByLabelText("Sort projects")).toHaveValue("recent");
    expect(
      screen.getByText("Shape the sound").closest("details"),
    ).not.toHaveAttribute("open");
    expect(
      screen.queryByRole("link", { name: "Clear all" }),
    ).not.toBeInTheDocument();
  });

  it("opens the disclosure and preserves every active URL-backed value", () => {
    render(
      <DiscoveryFilters
        filters={{
          ...baseFilters,
          query: "midnight",
          genres: ["ambient"],
          keys: ["c-minor"],
          bpmMin: 90,
          bpmMax: 120,
          openOnly: true,
          sort: "trending",
        }}
        options={options}
      />,
    );

    expect(
      screen.getByText("Shape the sound").closest("details"),
    ).toHaveAttribute("open");
    expect(screen.getByLabelText("Search projects")).toHaveValue("midnight");
    expect(screen.getByLabelText("Sort projects")).toHaveValue("trending");
    expect(screen.getByLabelText("Ambient")).toBeChecked();
    expect(screen.getByLabelText("Musical key")).toHaveValue("c-minor");
    expect(screen.getByLabelText("Minimum BPM")).toHaveValue("90");
    expect(screen.getByLabelText("Maximum BPM")).toHaveValue("120");
    expect(screen.getByLabelText("Open to contributions")).toBeChecked();
    expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute(
      "href",
      "/explore",
    );
  });
});
