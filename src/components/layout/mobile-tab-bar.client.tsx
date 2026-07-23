"use client";

import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiBarChart2, FiGrid, FiSearch } from "react-icons/fi";
import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/features/auth/actions";
import { useHeaderPathname } from "./header-route.client";
import {
  accountLinksForViewer,
  exploreLinks,
  isAccountCurrent,
  isAccountLinkCurrent,
  isDashboardCurrent,
  isExploreCurrent,
  isExploreLinkCurrent,
  isStudioCurrent,
} from "./nav-items";
import { useViewer } from "./viewer-identity-provider.client";

type SheetName = "explore" | "account";

const SHEET_DISMISS_OFFSET = 72;
const SHEET_DISMISS_VELOCITY = 650;

export function shouldDismissMobileSheet({
  offsetY,
  velocityY,
}: {
  offsetY: number;
  velocityY: number;
}) {
  return offsetY >= SHEET_DISMISS_OFFSET || velocityY >= SHEET_DISMISS_VELOCITY;
}

const tabClass = (current: boolean) =>
  `flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-semibold transition-colors ${
    current ? "bg-accent/12 text-accent" : "text-muted hover:text-ink"
  }`;

/**
 * The mobile primary navigation: four thumb-zone tabs, with the two grouped
 * destinations raising a bottom sheet (docs/design/brand.md §5). It is the same
 * information architecture as the desktop header — see `nav-items.ts` — rendered
 * for a phone instead of a pointer.
 */
export function MobileTabBar() {
  const pathname = useHeaderPathname();
  const viewer = useViewer();
  const reduce = useReducedMotion();
  const dragControls = useDragControls();
  const handleDragged = useRef(false);

  // Open-ness is stored with the route it was opened on, so a completed
  // navigation closes the sheet without an effect chasing the pathname.
  const [opened, setOpened] = useState<{ name: SheetName; on: string } | null>(
    null,
  );
  const active = opened && opened.on === pathname ? opened.name : null;

  const close = useCallback(() => setOpened(null), []);
  const toggle = useCallback(
    (name: SheetName) =>
      setOpened((current) =>
        current && current.name === name && current.on === pathname
          ? null
          : { name, on: pathname },
      ),
    [pathname],
  );

  useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, close]);

  const name = viewer.displayName ?? viewer.username ?? "Your account";
  const viewerLinks = accountLinksForViewer(viewer.username);

  return (
    <>
      <AnimatePresence>
        {active && (
          <motion.button
            key="scrim"
            type="button"
            aria-label="Close menu"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.24 }}
            className="bg-canvas/70 fixed inset-0 z-40 backdrop-blur-[2px] sm:hidden"
          />
        )}
      </AnimatePresence>

      <div className="fixed inset-x-0 bottom-0 z-50 sm:hidden">
        {/* One sheet, keyed constantly: switching between Explore and Account
            swaps the contents in place rather than stacking dialogs. Anchoring
            it to `bottom-full` lets it emerge from behind the persistent tab
            bar instead of covering the controls that opened it. */}
        <AnimatePresence>
          {active && (
            <motion.div
              key="sheet"
              initial={reduce ? { opacity: 0 } : { y: "100%" }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: "100%" }}
              transition={{
                duration: reduce ? 0 : 0.32,
                ease: [0.2, 0.8, 0.2, 1],
              }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 240 }}
              dragElastic={{ top: 0, bottom: 0.08 }}
              dragMomentum={false}
              dragSnapToOrigin
              onDragStart={() => {
                handleDragged.current = true;
              }}
              onDragEnd={(_, info: PanInfo) => {
                if (
                  shouldDismissMobileSheet({
                    offsetY: info.offset.y,
                    velocityY: info.velocity.y,
                  })
                )
                  close();
              }}
              className="nav-glass absolute inset-x-0 bottom-full z-0 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-y-contain rounded-t-[1.75rem] px-2 pb-2 sm:hidden"
              role="dialog"
              aria-modal="true"
              aria-label={active === "explore" ? "Explore" : "Account"}
            >
              <button
                type="button"
                aria-label={`Close ${active === "explore" ? "Explore" : "Account"} menu`}
                onPointerDown={(event) => {
                  handleDragged.current = false;
                  dragControls.start(event);
                }}
                onClick={() => {
                  if (!handleDragged.current) close();
                }}
                className="mx-auto flex h-8 w-16 touch-none items-center justify-center select-none"
              >
                <span
                  aria-hidden="true"
                  className="bg-ink/20 h-1 w-9 rounded-full"
                />
              </button>
              {active === "explore" ? (
                <nav aria-label="Explore">
                  <ul className="grid gap-0.5">
                    {exploreLinks.map((link) => {
                      const current = isExploreLinkCurrent(pathname, link.href);
                      return (
                        <li key={link.href}>
                          <IntentPrefetchLink
                            href={link.href}
                            onClick={close}
                            aria-current={current ? "page" : undefined}
                            className={`hover:bg-ink/[0.07] flex min-h-12 items-center rounded-full px-4 font-medium transition-colors ${current ? "text-accent" : "text-muted hover:text-ink"}`}
                          >
                            {link.label}
                          </IntentPrefetchLink>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-4 pb-3">
                    <Avatar
                      avatarConfig={viewer.avatarConfig}
                      name={name}
                      size="sm"
                      decorative
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {name}
                      </span>
                      {viewer.username && (
                        <span className="text-muted block truncate font-mono text-xs">
                          @{viewer.username}
                        </span>
                      )}
                    </span>
                  </div>
                  <hr className="border-subtle border-t" />
                  <nav aria-label="Account" className="pt-1.5">
                    <ul className="grid gap-0.5">
                      {viewerLinks.map((link) => {
                        const current = isAccountLinkCurrent(
                          pathname,
                          link.href,
                        );
                        return (
                          <li key={link.href}>
                            <IntentPrefetchLink
                              href={link.href}
                              onClick={close}
                              aria-current={current ? "page" : undefined}
                              className={`hover:bg-ink/[0.07] flex min-h-12 items-center rounded-full px-4 font-medium transition-colors ${current ? "text-accent" : "text-muted hover:text-ink"}`}
                            >
                              {link.label}
                            </IntentPrefetchLink>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                  <hr className="border-subtle mt-1.5 border-t" />
                  <form action={signOut} className="pt-1.5">
                    <button
                      type="submit"
                      className="hover:bg-ink/[0.07] text-muted hover:text-danger flex min-h-12 w-full items-center rounded-full px-4 font-medium transition-colors"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <nav
          aria-label="Primary mobile"
          className="border-subtle bg-canvas/90 pb-safe relative z-10 grid grid-cols-4 gap-0.5 border-t px-1.5 pt-1.5 backdrop-blur-xl"
        >
          <IntentPrefetchLink
            href="/dashboard"
            aria-current={isDashboardCurrent(pathname) ? "page" : undefined}
            className={tabClass(isDashboardCurrent(pathname))}
          >
            <FiGrid aria-hidden="true" className="text-lg" />
            Dashboard
          </IntentPrefetchLink>

          <button
            type="button"
            onClick={() => toggle("explore")}
            aria-expanded={active === "explore"}
            className={tabClass(
              isExploreCurrent(pathname) || active === "explore",
            )}
          >
            <FiSearch aria-hidden="true" className="text-lg" />
            Explore
          </button>

          <IntentPrefetchLink
            href="/studio"
            aria-current={isStudioCurrent(pathname) ? "page" : undefined}
            className={tabClass(isStudioCurrent(pathname))}
          >
            <FiBarChart2 aria-hidden="true" className="text-lg" />
            Studio
          </IntentPrefetchLink>

          <button
            type="button"
            onClick={() => toggle("account")}
            aria-expanded={active === "account"}
            className={tabClass(
              isAccountCurrent(pathname, viewerLinks) || active === "account",
            )}
          >
            <Avatar
              avatarConfig={viewer.avatarConfig}
              name={name}
              size="xs"
              decorative
            />
            Account
          </button>
        </nav>
      </div>
    </>
  );
}
