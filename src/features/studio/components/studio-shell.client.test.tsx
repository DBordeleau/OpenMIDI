import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MutableStudioLifecycle } from "../switch-coordinator";
import { useStudioLifecycleRegistration } from "./studio-shell.client";

vi.mock("@/features/studio/studio-actions", () => ({
  listStudioProjectsAction: vi.fn(),
}));

function AlternateStudioSurface() {
  useStudioLifecycleRegistration(
    new MutableStudioLifecycle({
      status: "saved",
      generation: 0,
      acknowledgedGeneration: 0,
      recoveryAvailable: false,
    }),
  );
  return <p>Alternate studio surface</p>;
}

describe("Studio lifecycle registration", () => {
  it("keeps alternate read-only surfaces usable outside the canonical shell", () => {
    expect(() => render(<AlternateStudioSurface />)).not.toThrow();
  });
});
