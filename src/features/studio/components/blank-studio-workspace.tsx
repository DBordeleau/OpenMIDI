import {
  FiCrosshair,
  FiMinus,
  FiPlay,
  FiPlus,
  FiRotateCcw,
  FiRotateCw,
} from "react-icons/fi";

const disabledIcon =
  "border-strong text-muted grid h-9 w-9 shrink-0 place-items-center rounded-full border opacity-40";

export function BlankStudioWorkspace() {
  return (
    <>
      <section
        className="border-strong bg-surface rounded-card overflow-hidden border shadow-xl max-md:hidden [@media(pointer:coarse)]:hidden"
        aria-label="Blank arrangement workspace"
      >
        <header className="border-subtle bg-surface-raised flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <div className="flex items-center gap-2" aria-label="Transport">
            <button
              type="button"
              className="cta-gradient grid h-11 w-11 place-items-center rounded-full text-lg opacity-40"
              aria-label="Play arrangement"
              aria-describedby="blank-project-control-reason"
              disabled
            >
              <FiPlay aria-hidden />
            </button>
            <p className="min-w-24 font-mono text-sm">1.1.1</p>
            <p className="text-muted hidden text-xs lg:block">120 BPM · 4/4</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-muted hidden text-[10px] font-semibold uppercase md:block">
              Snap
              <select
                aria-label="Arrangement snap grid"
                aria-describedby="blank-project-control-reason"
                className="border-strong bg-canvas rounded-control ml-2 h-9 border px-2 text-xs opacity-60"
                disabled
              >
                <option>1/16</option>
              </select>
            </label>
            <BlankControl label="Undo arrangement edit">
              <FiRotateCcw aria-hidden />
            </BlankControl>
            <BlankControl label="Redo arrangement edit">
              <FiRotateCw aria-hidden />
            </BlankControl>
            <BlankControl label="Zoom out">
              <FiMinus aria-hidden />
            </BlankControl>
            <span className="text-muted w-14 text-center font-mono text-xs">
              100%
            </span>
            <BlankControl label="Zoom in">
              <FiPlus aria-hidden />
            </BlankControl>
            <BlankControl label="Follow playhead">
              <FiCrosshair aria-hidden />
            </BlankControl>
          </div>
        </header>

        <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 overflow-hidden">
            <div className="border-subtle bg-surface grid h-11 grid-cols-[15rem_1fr] border-b">
              <div className="border-subtle flex items-center border-r px-3">
                <span className="text-muted font-mono text-[10px] tracking-widest uppercase">
                  Channels
                </span>
              </div>
              <div className="relative" aria-label="Arrangement ruler">
                {Array.from({ length: 9 }, (_, index) => (
                  <span
                    aria-hidden
                    key={index}
                    className="border-subtle text-muted absolute top-0 h-full border-l text-left font-mono text-[10px]"
                    style={{ left: `${index * 12.5}%` }}
                  >
                    <span className="ml-1">{index + 1}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="relative min-h-80">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  aria-hidden
                  key={index}
                  className="border-subtle grid h-28 grid-cols-[15rem_1fr] border-b"
                >
                  <div className="border-subtle bg-surface border-r p-3">
                    <span className="bg-surface-raised block h-3 w-24 rounded-full" />
                    <span className="bg-surface-raised mt-3 block h-2 w-36 rounded-full" />
                    <div className="mt-5 flex gap-2">
                      <span className="border-strong h-8 w-8 rounded-full border" />
                      <span className="border-strong h-8 w-8 rounded-full border" />
                    </div>
                  </div>
                  <div className="relative overflow-hidden">
                    {Array.from({ length: 9 }, (_, mark) => (
                      <span
                        key={mark}
                        className="border-subtle absolute inset-y-0 border-l opacity-30"
                        style={{ left: `${mark * 12.5}%` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
                <div className="border-subtle bg-surface/95 rounded-card max-w-md border px-7 py-6 shadow-xl backdrop-blur-sm">
                  <h1 className="text-xl font-semibold">No project open</h1>
                  <p className="text-muted mt-2 leading-6">
                    Choose File → New project or File → Open project to start a
                    private Studio session.
                  </p>
                  <p className="text-accent-2 mt-3 text-sm font-semibold">
                    This blank arrangement is not saved.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside
            className="border-subtle bg-surface-raised min-w-0 border-t p-4 xl:border-t-0 xl:border-l"
            aria-label="Inspector"
          >
            <p className="text-accent font-mono text-[10px] tracking-widest uppercase">
              Inspector
            </p>
            <p className="text-muted mt-3 text-sm">
              Open a project, then select a track or clip to inspect exact
              values.
            </p>
          </aside>
        </div>

        <footer className="border-subtle bg-surface-raised flex min-h-12 flex-wrap items-center justify-between gap-3 border-t px-4 py-2">
          <p
            id="blank-project-control-reason"
            className="text-muted text-xs"
            role="status"
          >
            No project open · Project controls are unavailable
          </p>
          <p className="text-muted text-xs">Nothing to save</p>
        </footer>
      </section>

      <section className="border-strong bg-surface rounded-card hidden border p-6 shadow-xl max-md:block [@media(pointer:coarse)]:block">
        <h1 className="text-xl font-semibold">Studio needs a desktop setup</h1>
        <p className="text-muted mt-2 leading-7">
          Use a desktop-sized screen and a precise pointer to arrange music in
          Studio. No project or draft has been created.
        </p>
      </section>
    </>
  );
}

function BlankControl({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={disabledIcon}
      aria-label={label}
      aria-describedby="blank-project-control-reason"
      disabled
    >
      {children}
    </button>
  );
}
