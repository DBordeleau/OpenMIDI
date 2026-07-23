"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const EMPTY_SUBSCRIBE = () => () => {};

function useStudioTopBarSlot() {
  return useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => document.getElementById("studio-source-slot"),
    () => null,
  );
}

export function StudioTopBarPortal({
  children,
}: {
  children: React.ReactNode;
}) {
  const slot = useStudioTopBarSlot();
  return slot ? createPortal(children, slot) : children;
}
