import Link from "next/link";
import { requireViewer } from "@/features/auth/guards";

export default async function StudioStartPage() {
  await requireViewer("/studio");

  return (
    <section className="rounded-card border-subtle bg-surface overflow-hidden border shadow-xl">
      <div className="border-subtle border-b px-6 py-10 sm:px-10 sm:py-14">
        <p className="text-accent text-sm font-semibold tracking-widest uppercase">
          Your session starts here
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Open the music you want to shape.
        </h1>
        <p className="text-muted mt-5 max-w-2xl text-lg leading-8">
          Choose an existing project or begin a new one. Studio only starts its
          editing and audio engine after you open a project.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/projects/new"
            className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center rounded-full px-5 py-3 font-semibold transition-transform hover:-translate-y-px"
          >
            New project
          </Link>
          <Link
            href="/projects"
            className="border-strong bg-surface-raised hover:border-accent hover:text-accent inline-flex min-h-11 items-center rounded-full border px-5 py-3 font-semibold transition-colors"
          >
            Open project
          </Link>
        </div>
      </div>
      <div className="grid gap-6 px-6 py-8 sm:grid-cols-2 sm:px-10">
        <div>
          <h2 className="text-lg font-semibold">Bring a project into focus</h2>
          <p className="text-muted mt-2 leading-7">
            Owner drafts, contribution workspaces, and published arrangements
            each open with the access your role allows.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Desktop workspace</h2>
          <p className="text-muted mt-2 leading-7">
            Editing currently needs a desktop-sized screen, a precise pointer,
            and a secure browser with Web Audio support.
          </p>
        </div>
      </div>
    </section>
  );
}
