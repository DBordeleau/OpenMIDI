import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
  id,
}: Readonly<{ children: ReactNode; className?: string; id?: string }>) {
  return (
    <div
      id={id}
      className={`mx-auto w-full max-w-[var(--content-width)] px-5 sm:px-8 lg:px-12 ${className}`}
    >
      {children}
    </div>
  );
}
