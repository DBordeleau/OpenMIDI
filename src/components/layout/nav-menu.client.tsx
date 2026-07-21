"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { useHeaderPathname } from "./header-route.client";

/**
 * A disclosure-style navigation dropdown. It deliberately uses button +
 * `aria-expanded`/`aria-controls` over ARIA menu roles: these panels hold
 * ordinary navigation links, so plain Tab order is more predictable for
 * assistive technology than a roving-focus menu widget.
 */
const NavMenuContext = createContext<{ close(): void } | null>(null);

export function NavMenu({
  label,
  triggerClassName,
  triggerContent,
  align = "start",
  panelClassName = "",
  children,
}: {
  /** Accessible name of the trigger. */
  label: string;
  triggerClassName: string;
  triggerContent: (state: { open: boolean }) => ReactNode;
  align?: "start" | "end";
  panelClassName?: string;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = useHeaderPathname();
  const reduce = useReducedMotion();

  // Open-ness is stored as the route it was opened on, so any completed
  // navigation closes the panel without an effect that chases the pathname —
  // including a back/forward move the panel never saw a click for.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  const close = useCallback(() => setOpenedOn(null), []);
  const setOpen = useCallback(
    (next: boolean) => setOpenedOn(next ? pathname : null),
    [pathname],
  );

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      close();
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          close();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        className={triggerClassName}
        onClick={() => setOpen(!open)}
      >
        {triggerContent({ open })}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              transformOrigin: align === "end" ? "top right" : "top left",
            }}
            className={`nav-glass rounded-card absolute top-full z-40 mt-2 min-w-56 p-1.5 ${align === "end" ? "right-0" : "left-0"} ${panelClassName}`}
          >
            <NavMenuContext.Provider value={{ close }}>
              {children}
            </NavMenuContext.Provider>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NavMenuLink({
  href,
  children,
  current = false,
}: {
  href: string;
  children: ReactNode;
  current?: boolean;
}) {
  const menu = useContext(NavMenuContext);
  return (
    <IntentPrefetchLink
      href={href}
      aria-current={current ? "page" : undefined}
      onClick={() => menu?.close()}
      className={`hover:bg-ink/[0.07] flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${current ? "text-accent" : "text-muted hover:text-ink"}`}
    >
      {children}
    </IntentPrefetchLink>
  );
}

export function NavMenuSeparator() {
  return <hr className="border-subtle my-1.5 border-t" />;
}
