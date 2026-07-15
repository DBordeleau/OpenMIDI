import { describe, expect, it, vi } from "vitest";
import {
  coordinateStudioExit,
  getStudioSwitchStep,
  MutableStudioLifecycle,
  type StudioLifecycleSnapshot,
} from "./switch-coordinator";

const snapshot = (
  status: StudioLifecycleSnapshot["status"],
  generation = 1,
  acknowledgedGeneration = status === "saved" ? generation : 0,
): StudioLifecycleSnapshot => ({
  status,
  generation,
  acknowledgedGeneration,
  recoveryAvailable: status !== "saved",
});

describe("Studio switch coordinator", () => {
  it.each([
    [snapshot("saved"), 1, "dispose"],
    [snapshot("dirty"), 1, "request-save"],
    [snapshot("saving"), 1, "wait"],
    [snapshot("offline"), 1, "confirm-recovery"],
    [snapshot("error"), 1, "confirm-recovery"],
    [snapshot("conflict"), 1, "confirm-conflict"],
    [snapshot("saved", 2, 1), 2, "request-save"],
  ] as const)("maps %s to %s", (state, target, expected) => {
    expect(getStudioSwitchStep(state, target)).toBe(expected);
  });

  it("requests and awaits the dirty generation before disposal", async () => {
    const lifecycle = new MutableStudioLifecycle(snapshot("dirty", 1, 0));
    const dispose = vi.fn(async () => undefined);
    const requestSave = vi.fn(() => {
      lifecycle.update(snapshot("saving", 1, 0));
      queueMicrotask(() => lifecycle.update(snapshot("saved", 1, 1)));
    });
    lifecycle.configure({
      requestSave,
      preserveRecovery: async () => true,
      dispose,
    });

    await expect(
      coordinateStudioExit(lifecycle, async () => false),
    ).resolves.toBe("left");
    expect(requestSave).toHaveBeenCalledWith(1);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it.each(["offline", "error", "conflict"] as const)(
    "preserves recovery and requires an explicit choice for %s",
    async (status) => {
      const lifecycle = new MutableStudioLifecycle(snapshot(status));
      const dispose = vi.fn(async () => undefined);
      const preserveRecovery = vi.fn(async () => true);
      lifecycle.configure({
        requestSave: vi.fn(),
        preserveRecovery,
        dispose,
      });

      await expect(
        coordinateStudioExit(lifecycle, async () => false),
      ).resolves.toBe("stayed");
      expect(preserveRecovery).toHaveBeenCalledOnce();
      expect(dispose).not.toHaveBeenCalled();
    },
  );
});
