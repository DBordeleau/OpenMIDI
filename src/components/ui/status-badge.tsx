export function StatusBadge({ children }: Readonly<{ children: string }>) {
  return (
    <span className="border-strong bg-surface text-muted inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold">
      <span aria-hidden="true" className="bg-accent size-1.5 rounded-full" />
      {children}
    </span>
  );
}
