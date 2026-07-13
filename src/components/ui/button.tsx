import Link from "next/link";

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: Readonly<{
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}>) {
  const styles =
    variant === "primary"
      ? "bg-accent text-accent-contrast hover:bg-accent-strong"
      : "border border-strong bg-surface text-ink hover:border-accent hover:text-accent";
  return (
    <Link
      href={href}
      className={`rounded-control inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm font-semibold transition-colors ${styles}`}
    >
      {children}
    </Link>
  );
}

export function Button({
  children,
  onClick,
}: Readonly<{ children: React.ReactNode; onClick?: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-control bg-accent text-accent-contrast hover:bg-accent-strong min-h-11 px-5 py-3 text-sm font-semibold transition-colors"
    >
      {children}
    </button>
  );
}
