import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Aurora } from "@/components/layout/aurora.client";
import { ConditionalFooter } from "@/components/layout/conditional-footer.client";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Jam Session",
    template: "%s | Jam Session",
  },
  description:
    "Jam Session is where MIDI ideas become shared arrangements, with every contributor credited.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen">
        <Aurora />
        <div className="relative z-10 flex min-h-screen flex-col">
          <SkipLink />
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <ConditionalFooter />
        </div>
      </body>
    </html>
  );
}
