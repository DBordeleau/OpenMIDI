import type { IconType } from "react-icons";

export function ProfileEmptyState({
  Icon,
  title,
  message,
}: {
  Icon: IconType;
  title: string;
  message: string;
}) {
  return (
    <div className="dash-card rounded-card border-subtle flex items-start gap-3 border border-dashed p-4 sm:p-5">
      <span
        aria-hidden="true"
        className="border-subtle bg-surface/70 text-muted grid size-10 place-items-center rounded-full border text-lg"
      >
        <Icon />
      </span>
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="text-muted mt-1 max-w-[42ch] text-sm leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
}
