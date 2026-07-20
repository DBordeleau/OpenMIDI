import Link from "next/link";

export function ButtonLink({
  href,
  children,
  variant = "primary",
  prefetch,
}: Readonly<{
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  prefetch?: false;
}>) {
  const styles =
    variant === "primary"
      ? "cta-gradient text-accent-contrast hover:-translate-y-px"
      : "border border-strong bg-surface text-ink hover:border-accent hover:text-accent";
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition motion-reduce:transform-none motion-reduce:transition-none ${styles}`}
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
      className="cta-gradient text-accent-contrast min-h-11 rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-px motion-reduce:transform-none motion-reduce:transition-none"
    >
      {children}
    </button>
  );
}
