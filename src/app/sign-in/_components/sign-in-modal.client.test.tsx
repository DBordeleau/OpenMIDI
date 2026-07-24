import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignInModal } from "./sign-in-modal.client";

const reducedMotion = vi.hoisted(() => vi.fn(() => false));
const router = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));
vi.mock("motion/react", async () => {
  const React = await import("react");
  type MotionDivProps = ComponentProps<"div"> & {
    animate?: unknown;
    exit?: unknown;
    initial?: unknown;
    transition?: unknown;
  };
  const MotionDiv = React.forwardRef<HTMLDivElement, MotionDivProps>(
    ({ animate, exit, initial, transition: _transition, ...props }, ref) => (
      <div
        {...props}
        ref={ref}
        data-motion-animate={JSON.stringify(animate)}
        data-motion-exit={JSON.stringify(exit)}
        data-motion-initial={JSON.stringify(initial)}
        data-motion-transition={JSON.stringify(_transition)}
      />
    ),
  );
  MotionDiv.displayName = "MotionDiv";

  function AnimatePresence({
    children,
    onExitComplete,
  }: {
    children: ReactNode;
    onExitComplete?: () => void;
  }) {
    const hadChildren = React.useRef(Boolean(children));
    React.useEffect(() => {
      if (hadChildren.current && !children) onExitComplete?.();
      hadChildren.current = Boolean(children);
    }, [children, onExitComplete]);
    return children;
  }

  return {
    AnimatePresence,
    motion: { div: MotionDiv },
    useReducedMotion: reducedMotion,
  };
});

function renderModal(presentation: "direct" | "intercepted") {
  return render(
    <>
      <button type="button">Opening trigger</button>
      <SignInModal presentation={presentation}>
        <h1 id="signin-title">Open beta coming soon!</h1>
        <button type="button">Continue with Google</button>
      </SignInModal>
    </>,
  );
}

describe("SignInModal", () => {
  beforeEach(() => {
    reducedMotion.mockReturnValue(false);
    router.back.mockReset();
    router.push.mockReset();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("moves and contains focus, locks scroll, and restores the exact opener", async () => {
    const openingTrigger = document.createElement("button");
    openingTrigger.textContent = "Opening trigger";
    document.body.append(openingTrigger);
    openingTrigger.focus();

    const { unmount } = render(
      <SignInModal presentation="intercepted">
        <h1 id="signin-title">Open beta coming soon!</h1>
        <button type="button">Continue with Google</button>
      </SignInModal>,
    );

    const close = screen.getByRole("button", { name: "Close sign in" });
    const continueButton = screen.getByRole("button", {
      name: "Continue with Google",
    });
    expect(close).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(continueButton).toHaveFocus();
    fireEvent.keyDown(continueButton, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(router.back).toHaveBeenCalledOnce());
    expect(router.push).not.toHaveBeenCalled();
    expect(openingTrigger).toHaveFocus();

    unmount();
    expect(document.body.style.overflow).toBe("");
    openingTrigger.remove();
  });

  it("dismisses from the backdrop without treating card interaction as dismissal", async () => {
    renderModal("intercepted");
    const backdrop = document.querySelector("[data-sign-in-backdrop]");
    const dialog = screen.getByRole("dialog", {
      name: "Open beta coming soon!",
    });
    expect(backdrop).not.toBeNull();

    fireEvent.pointerDown(dialog);
    expect(dialog).toBeInTheDocument();
    fireEvent.pointerDown(backdrop!);

    await waitFor(() => expect(router.back).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("routes a direct presentation home and removes movement for reduced motion", async () => {
    reducedMotion.mockReturnValue(true);
    renderModal("direct");

    const dialog = screen.getByRole("dialog", {
      name: "Open beta coming soon!",
    });
    expect(JSON.parse(dialog.dataset.motionInitial ?? "{}")).toEqual({
      opacity: 0,
    });
    expect(JSON.parse(dialog.dataset.motionExit ?? "{}")).toEqual({
      opacity: 0,
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Close and return home" }),
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
    expect(router.back).not.toHaveBeenCalled();
  });
});
