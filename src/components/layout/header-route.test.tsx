import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HeaderRouteProvider,
  isStudioRoute,
  useHeaderPathname,
} from "./header-route.client";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

function Probe() {
  return <p>route: {useHeaderPathname()}</p>;
}

describe("header route", () => {
  afterEach(cleanup);

  it("identifies the routes that hide the shared header", () => {
    expect(isStudioRoute("/studio")).toBe(true);
    expect(isStudioRoute("/studio/project-id")).toBe(true);
    expect(isStudioRoute("/projects/project-id/studio")).toBe(false);
    expect(isStudioRoute("/dashboard")).toBe(false);
  });

  it("falls back to the live pathname outside the animated wrapper", () => {
    usePathname.mockReturnValue("/dashboard");
    render(<Probe />);
    expect(screen.getByText("route: /dashboard")).toBeInTheDocument();
  });

  it("keeps rendering the provided route after navigation, so the exiting header does not restyle itself", () => {
    // What AnimatePresence does for an exiting child: the element — and so the
    // provider's captured prop — stays at the last route the header was shown
    // for, even though the live pathname has already moved to the Studio.
    usePathname.mockReturnValue("/dashboard");
    const { rerender } = render(
      <HeaderRouteProvider pathname="/dashboard">
        <Probe />
      </HeaderRouteProvider>,
    );

    usePathname.mockReturnValue("/studio/project-id");
    rerender(
      <HeaderRouteProvider pathname="/dashboard">
        <Probe />
      </HeaderRouteProvider>,
    );

    expect(screen.getByText("route: /dashboard")).toBeInTheDocument();
  });
});
