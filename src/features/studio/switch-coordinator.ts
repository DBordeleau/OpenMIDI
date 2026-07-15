export type StudioSaveStatus =
  "saved" | "dirty" | "saving" | "offline" | "error" | "conflict";

export type StudioLifecycleSnapshot = {
  status: StudioSaveStatus;
  generation: number;
  acknowledgedGeneration: number;
  recoveryAvailable: boolean;
};

export type StudioSessionLifecyclePort = {
  getSnapshot(): StudioLifecycleSnapshot;
  subscribe(listener: () => void): () => void;
  requestSave(generation: number): void;
  preserveRecovery(): Promise<boolean>;
  dispose(): Promise<void>;
};

export type StudioLeaveDecision = "recovery" | "conflict";

export function getStudioSwitchStep(
  snapshot: StudioLifecycleSnapshot,
  targetGeneration: number,
) {
  if (snapshot.status === "conflict") return "confirm-conflict" as const;
  if (snapshot.status === "offline" || snapshot.status === "error")
    return "confirm-recovery" as const;
  if (
    snapshot.status === "saved" &&
    snapshot.acknowledgedGeneration >= targetGeneration &&
    snapshot.acknowledgedGeneration >= snapshot.generation
  )
    return "dispose" as const;
  if (snapshot.status === "dirty" || snapshot.status === "saved")
    return "request-save" as const;
  return "wait" as const;
}

export async function coordinateStudioExit(
  port: StudioSessionLifecyclePort | null,
  confirmLeave: (decision: StudioLeaveDecision) => Promise<boolean>,
): Promise<"left" | "stayed"> {
  return coordinateStudioSaveOrExit(port, confirmLeave, true);
}

export async function coordinateStudioSave(
  port: StudioSessionLifecyclePort | null,
  confirmLeave: (decision: StudioLeaveDecision) => Promise<boolean>,
): Promise<boolean> {
  return (
    (await coordinateStudioSaveOrExit(port, confirmLeave, false)) === "left"
  );
}

async function coordinateStudioSaveOrExit(
  port: StudioSessionLifecyclePort | null,
  confirmLeave: (decision: StudioLeaveDecision) => Promise<boolean>,
  dispose: boolean,
): Promise<"left" | "stayed"> {
  if (!port) return "left";
  const targetGeneration = port.getSnapshot().generation;

  for (;;) {
    const snapshot = port.getSnapshot();
    const step = getStudioSwitchStep(snapshot, targetGeneration);
    if (step === "dispose") {
      if (dispose) await port.dispose();
      return "left";
    }
    if (step === "confirm-conflict" || step === "confirm-recovery") {
      const recoveryAvailable = await port.preserveRecovery();
      if (!recoveryAvailable) return "stayed";
      const leave = await confirmLeave(
        step === "confirm-conflict" ? "conflict" : "recovery",
      );
      if (!leave) return "stayed";
      if (dispose) await port.dispose();
      return "left";
    }

    const changed = waitForLifecycleChange(port, snapshot);
    if (step === "request-save") port.requestSave(targetGeneration);
    await changed;
  }
}

function waitForLifecycleChange(
  port: StudioSessionLifecyclePort,
  previous: StudioLifecycleSnapshot,
) {
  return new Promise<void>((resolve) => {
    const unsubscribe = port.subscribe(() => {
      if (port.getSnapshot() === previous) return;
      unsubscribe();
      resolve();
    });
  });
}

export class MutableStudioLifecycle implements StudioSessionLifecyclePort {
  private listeners = new Set<() => void>();
  private handlers: Pick<
    StudioSessionLifecyclePort,
    "requestSave" | "preserveRecovery" | "dispose"
  > = {
    requestSave: () => undefined,
    preserveRecovery: async () => true,
    dispose: async () => undefined,
  };

  constructor(private snapshot: StudioLifecycleSnapshot) {}

  configure(
    handlers: Pick<
      StudioSessionLifecyclePort,
      "requestSave" | "preserveRecovery" | "dispose"
    >,
  ) {
    this.handlers = handlers;
  }

  update(snapshot: StudioLifecycleSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  requestSave = (generation: number) => this.handlers.requestSave(generation);

  preserveRecovery = () => this.handlers.preserveRecovery();

  dispose = () => this.handlers.dispose();
}
