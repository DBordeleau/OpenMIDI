import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { HeroReveal } from "./_components/hero-reveal";

const workflow = [
  [
    "Project",
    "Create from stems",
    "Begin with source audio, context, and clear ownership.",
  ],
  [
    "Workspace",
    "Explore privately",
    "Arrange and mix in a browser workspace based on a published revision.",
  ],
  [
    "Contribution",
    "Propose a change",
    "Submit a fixed version for the project owner to review—never an automatic merge.",
  ],
  [
    "Revision or fork",
    "Shape the history",
    "Accept the contribution as a new revision, or fork an independent direction with attribution intact.",
  ],
] as const;

const capabilities = [
  [
    "Versioned projects",
    "Immutable revisions are planned to make the current version, its history, and contributor attribution clear.",
  ],
  [
    "Browser workspace",
    "A focused workspace is planned for arranging stems, balancing a mix, and saving a private draft.",
  ],
  [
    "Review and discovery",
    "Contributions, owner review, forks, lineage, and public-project discovery form the planned collaboration loop.",
  ],
] as const;

export default function Home() {
  return (
    <>
      <Container className="py-20 sm:py-28 lg:py-36">
        <HeroReveal>
          <section aria-labelledby="page-title">
            <p className="text-accent font-mono text-xs font-semibold tracking-[0.18em] uppercase">
              Asynchronous music collaboration
            </p>
            <h1
              id="page-title"
              className="mt-6 max-w-5xl text-5xl leading-[0.96] font-semibold tracking-[-0.055em] text-balance sm:text-7xl lg:text-8xl"
            >
              Make music with a history you can follow.
            </h1>
            <p className="text-muted mt-7 max-w-2xl text-lg leading-8 sm:text-xl">
              Jam Session is a Git-inspired collaboration space being built for
              musicians to share stems, propose versions, and fork songs into
              new directions without losing the story or the credits.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <ButtonLink href="#workflow">See how it works</ButtonLink>
              <StatusBadge>Early MVP · not yet available</StatusBadge>
            </div>
          </section>
        </HeroReveal>
      </Container>

      <section
        className="border-subtle bg-surface-soft border-y py-16 sm:py-20"
        aria-labelledby="why-heading"
      >
        <Container>
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-accent text-sm font-semibold">
                Why Jam Session
              </p>
              <h2
                id="why-heading"
                className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                Music collaboration deserves clearer versions.
              </h2>
            </div>
            <div className="text-muted grid gap-5 text-lg leading-8 sm:grid-cols-2">
              <p>
                Exports drift across drives and message threads. It becomes hard
                to know which mix is current, what changed, or who shaped it.
              </p>
              <p>
                Jam Session proposes one shared, versioned workspace where ideas
                can be reviewed and explored while creative lineage stays
                visible.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section
        id="workflow"
        className="py-20 sm:py-28"
        aria-labelledby="workflow-heading"
      >
        <Container>
          <p className="text-accent text-sm font-semibold">
            A Git-inspired workflow, adapted for music
          </p>
          <h2
            id="workflow-heading"
            className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl"
          >
            From a shared starting point to the next musical direction.
          </h2>
          <ol className="mt-12 grid gap-4 lg:grid-cols-4">
            {workflow.map(([label, title, description], index) => (
              <li
                key={label}
                className="rounded-card border-subtle bg-surface shadow-raised relative border p-6"
              >
                <span className="text-accent font-mono text-xs">
                  0{index + 1} / {label}
                </span>
                <h3 className="mt-7 text-xl font-semibold">{title}</h3>
                <p className="text-muted mt-3 leading-7">{description}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section
        id="mvp"
        className="border-subtle bg-surface-soft border-y py-20 sm:py-24"
        aria-labelledby="mvp-heading"
      >
        <Container>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-accent text-sm font-semibold">
                The MVP being built
              </p>
              <h2
                id="mvp-heading"
                className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl"
              >
                A focused collaboration foundation.
              </h2>
            </div>
            <StatusBadge>Planned capabilities</StatusBadge>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {capabilities.map(([title, description]) => (
              <article
                key={title}
                className="rounded-card border-subtle bg-surface-raised border p-6"
              >
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-muted mt-3 leading-7">{description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-24" aria-labelledby="scope-heading">
        <Container>
          <div className="rounded-card border-strong bg-surface border p-7 sm:p-10">
            <p className="text-accent font-mono text-xs uppercase">
              Scope guardrail
            </p>
            <h2
              id="scope-heading"
              className="mt-4 text-2xl font-semibold sm:text-3xl"
            >
              A companion to the DAW—not a replacement for it.
            </h2>
            <p className="text-muted mt-4 max-w-3xl text-lg leading-8">
              Jam Session is intended for asynchronous sharing, review, history,
              and attribution. Professional production can stay in the tools
              musicians already know.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
