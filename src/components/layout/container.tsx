import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div
      className={`mx-auto w-full max-w-[var(--content-width)] px-5 sm:px-8 lg:px-12 ${className}`}
    >
      {children}
    </div>
  );
}
