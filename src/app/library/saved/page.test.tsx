import { describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import SavedMidiPatternsRedirect from "./page";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("saved clips compatibility route", () => {
  it("redirects to the exact saved collection source", () => {
    SavedMidiPatternsRedirect();
    expect(redirect).toHaveBeenCalledWith("/library/collection?source=saved");
  });
});
