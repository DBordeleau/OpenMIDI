import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Jam Session",
    template: "%s | Jam Session",
  },
  description:
    "A Git-inspired space for asynchronous music collaboration, versioned projects, contributions, and forks.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
