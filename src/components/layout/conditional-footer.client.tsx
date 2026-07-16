"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./site-footer";

/**
 * The studio is a full-viewport workspace: the marketing footer would only
 * steal vertical space and break the "this is software" feel. Every other
 * route keeps the shared footer.
 */
export function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/studio")) return null;
  return <SiteFooter />;
}
