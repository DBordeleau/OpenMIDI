"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "./site-header";

/**
 * The marketing landing ("/") ships its own transparent nav that bleeds over
 * the hero canvas, so the shared sticky header would double up there. Every
 * other route keeps the shared header.
 */
export function ConditionalHeader() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <SiteHeader />;
}
