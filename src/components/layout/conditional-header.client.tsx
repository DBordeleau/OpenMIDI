"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "./site-header";

/**
 * The marketing landing ("/") ships its own transparent nav that bleeds over
 * the hero canvas, so the shared sticky header would double up there. The
 * Studio ("/studio…") hides the site nav entirely: it renders as a single
 * full-viewport glass window like desktop DAW software, and its own top bar
 * carries navigation back out. Every other route keeps the shared header.
 */
export function ConditionalHeader() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  if (pathname === "/studio" || pathname.startsWith("/studio/")) return null;
  return <SiteHeader />;
}
