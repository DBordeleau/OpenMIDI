import type { ReactNode } from "react";

export default function PublicLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main id="main-content" tabIndex={-1}>
      {children}
    </main>
  );
}
