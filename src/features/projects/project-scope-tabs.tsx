import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";

export type ProjectScope = "all" | "owned" | "review";

const TABS: Array<{ value: ProjectScope; label: string; href: string }> = [
  { value: "all", label: "All projects", href: "/projects" },
  { value: "owned", label: "Owned by me", href: "/projects?scope=owned" },
  {
    value: "review",
    label: "Needs review",
    href: "/projects?scope=owned&review=1",
  },
];

/**
 * `scope` and `review` were already real filters on `listProjectsForViewer`, but
 * the only way to reach them was a hand-written URL or a dashboard link. Putting
 * them on the page costs one row and turns a hidden capability into a visible
 * one.
 */
export function ProjectScopeTabs({ current }: { current: ProjectScope }) {
  return (
    <nav
      aria-label="Project scope"
      // One scrolling row on a phone rather than a wrapped block: three chips
      // wrapping to two lines turned this into a ~90px box mostly made of empty
      // glass. From `sm` up it shrink-wraps instead, because a full-bleed bar
      // behind three short chips reads as a container waiting to be filled.
      className="dash-card rounded-card flex max-w-full gap-1.5 overflow-x-auto p-2 sm:inline-flex sm:flex-wrap sm:overflow-x-visible"
    >
      {TABS.map((tab) => {
        const active = tab.value === current;
        return (
          <IntentPrefetchLink
            key={tab.value}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${active ? "border-accent bg-accent/12 text-accent" : "text-muted hover:border-accent-2 hover:text-ink border-transparent"}`}
          >
            {tab.label}
          </IntentPrefetchLink>
        );
      })}
    </nav>
  );
}
