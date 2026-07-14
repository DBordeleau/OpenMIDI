import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/ui/reveal.client";
import { AuthAwareLink } from "@/features/auth/auth-aware-link.client";
import { FloatingCta } from "./_components/floating-cta.client";
import { HeroWaveform } from "./_components/hero-waveform.client";

const ctaPrimary =
  "cta-gradient inline-flex min-h-11 items-center justify-center rounded-full px-[22px] py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-px";
const ctaSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-strong px-[22px] py-3 text-sm font-semibold text-ink transition duration-200 hover:-translate-y-px hover:border-accent-2 hover:text-accent-2";
const kicker = "font-mono text-[11px] uppercase tracking-[0.2em] text-accent";
const h2 =
  "mt-3.5 max-w-[20ch] text-3xl font-bold tracking-[-0.03em] text-balance sm:text-4xl lg:text-5xl";
const lede = "mt-4 max-w-[48ch] text-lg leading-relaxed text-muted";

const steps = [
  [
    "Step 01",
    "Bring your stems",
    "Drop in a beat, a hook, or a half-finished demo. It stays yours, with a clear starting point.",
  ],
  [
    "Step 02",
    "Open the doors",
    "Mark it open for collaboration and let the community hear where it could go.",
  ],
  [
    "Step 03",
    "Build together",
    "Others add vocals, bass, or a new arrangement — right in the browser, no DAW required.",
  ],
  [
    "Step 04",
    "Credit everyone",
    "Accept the ideas you love. Every contributor keeps their credit, for good.",
  ],
] as const;

const tracks = [
  { name: "Drums", who: "Mara K.", mute: false, solo: false, seed: 2 },
  { name: "Bass", who: "Deniz V.", mute: false, solo: true, seed: 5 },
  { name: "Keys", who: "Mara K.", mute: true, solo: false, seed: 8 },
  { name: "Vocals", who: "Jae B. · new", mute: false, solo: false, seed: 11 },
] as const;

const lineage = [
  {
    ver: "Rev. 01",
    who: "Mara Keller",
    title: ["The first ", "loop", ""],
    body: "A four-bar keys idea, uploaded as a single stem and opened for collaboration.",
    fork: false,
  },
  {
    ver: "Rev. 04",
    who: "+ Jae Brooks",
    title: ["A ", "voice", " arrives"],
    body: "A vocal topline is proposed, reviewed, and accepted as a new revision — credit recorded.",
    fork: false,
  },
  {
    ver: "Fork · Rev. 01",
    who: "Deniz Vural",
    title: ["A ", "heavier", " direction"],
    body: "Deniz forks the song for a bassier club remix. The original lineage stays intact on both branches.",
    fork: true,
  },
  {
    ver: "Rev. 07",
    who: "+ Priya Anand",
    title: ["", "Mixed", " and shipped"],
    body: "A final mix ships with all six contributors named — permanently, wherever it travels.",
    fork: false,
  },
] as const;

const credits = [
  { role: "Written by", name: "Mara Keller", note: "original" },
  { role: "Vocals", name: "Jae Brooks", note: null },
  { role: "Bass & drums", name: "Deniz Vural", note: null },
  { role: "Add'l keys", name: "Mara Keller", note: null },
  { role: "Mix", name: "Priya Anand", note: null },
  { role: "Forked from", name: "“Loop 001”", note: "R. Okafor" },
] as const;

function trackBars(seed: number) {
  return Array.from({ length: 46 }, (_, i) =>
    Math.min(100, 16 + Math.abs(Math.sin(i * 0.7 + seed)) * 72 + (i % 3) * 6),
  );
}

export default function Home() {
  return (
    <>
      <div className="relative">
        {/* HERO */}
        <Container className="relative pt-8 pb-20 sm:pt-10 sm:pb-28">
          <section aria-labelledby="page-title">
            <Reveal>
              <p className="text-accent-2 font-mono text-[11.5px] font-semibold tracking-[0.24em] uppercase">
                Open-sourcing collaborative music production
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1
                id="page-title"
                className="mt-5 max-w-[16ch] text-[clamp(42px,6.8vw,92px)] leading-[0.97] font-bold tracking-[-0.035em] text-balance"
              >
                Your song isn&apos;t done.
                <br />
                It&apos;s waiting for
                <br />
                the{" "}
                <em className="text-accent font-serif font-medium">
                  right people
                </em>
                .
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-muted mt-7 max-w-[52ch] text-[clamp(16px,1.7vw,20px)] leading-[1.62]">
                Jam Session is where an unfinished idea finds its collaborators.
                Upload your stems, open the doors, and let producers, vocalists,
                and players around the world turn it into something none of you
                could make alone.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <AuthAwareLink
                  signedOut={{ href: "/sign-in", label: "Create something" }}
                  signedIn={{
                    href: "/projects/new",
                    label: "Create something",
                  }}
                  className={ctaPrimary}
                />
                <a href="#console" className={`${ctaSecondary} group gap-1.5`}>
                  Hear what&apos;s brewing
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-muted mt-5 flex items-center gap-2.5 text-[13px]">
                <span className="bg-accent-2 h-1.5 w-1.5 rounded-full shadow-[0_0_10px_var(--color-accent-2)]" />
                Invite-only while we&apos;re in beta
              </p>
            </Reveal>
            <Reveal delay={0.28}>
              <div className="mt-16">
                <HeroWaveform />
              </div>
            </Reveal>
          </section>
        </Container>

        {/* HOW A SONG GROWS */}
        <Container className="py-20 sm:py-24" id="how">
          <Reveal>
            <p className={kicker}>How a song grows here</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className={h2}>
              Four steps from a lonely idea to a shared record.
            </h2>
          </Reveal>
          <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([n, title, body], i) => (
              <Reveal
                key={title}
                delay={i * 0.06}
                className="relative border-t border-[var(--color-border)] pt-6.5"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-[-1px] left-0 h-0.5 w-9"
                  style={{
                    background:
                      "linear-gradient(90deg,var(--color-accent),var(--color-accent-2))",
                  }}
                />
                <span className="text-accent-2 font-mono text-xs tracking-[0.1em]">
                  {n}
                </span>
                <h3 className="mt-4 text-lg font-semibold tracking-[-0.01em]">
                  {title}
                </h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  {body}
                </p>
              </Reveal>
            ))}
          </ol>
        </Container>

        {/* SHARED CONSOLE */}
        <Container className="py-20 sm:py-24" id="console">
          <Reveal>
            <p className={kicker}>Build it together, in the browser</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className={h2}>
              One project. Every take.{" "}
              <em className="text-accent font-serif font-medium">Everyone</em>{" "}
              in the mix.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className={lede}>
              Open a project and hear every contribution mixed together in real
              time. Reach for faders, not file transfers — audition
              anyone&apos;s take, then keep experimenting in your own private
              space that autosaves as you go.
            </p>
          </Reveal>
          <div className="mt-12 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.32fr)_minmax(0,0.68fr)]">
            <Reveal
              className="rounded-card border-subtle min-w-0 overflow-hidden border p-2 shadow-[0_34px_90px_-46px_#000]"
              style={{
                background:
                  "linear-gradient(180deg,var(--color-surface-raised),var(--color-surface-soft))",
              }}
            >
              <div className="border-subtle flex flex-col items-start gap-1.5 border-b px-3 pt-3.5 pb-3 sm:flex-row sm:items-center sm:gap-3 sm:px-[18px]">
                <b className="text-sm font-semibold">Midnight Loop</b>
                <span className="text-muted font-mono text-[10px] leading-relaxed tracking-[0.12em] uppercase sm:ml-auto sm:text-right">
                  <span className="text-accent-2 inline-flex items-center gap-1.5">
                    <span className="bg-accent-2 h-[7px] w-[7px] rounded-full shadow-[0_0_10px_var(--color-accent-2)]" />
                    Live mix
                  </span>{" "}
                  · 124 BPM · Am
                </span>
              </div>
              {tracks.map((t, ti) => (
                <div
                  key={t.name}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:gap-3.5 sm:px-4 sm:py-3.5 ${
                    ti > 0 ? "border-subtle border-t" : ""
                  }`}
                >
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <b className="text-sm font-semibold tracking-[-0.01em]">
                      {t.name}
                    </b>
                    <span
                      className={`font-mono text-[10px] tracking-[0.08em] uppercase ${
                        t.who.includes("new") ? "text-berry" : "text-muted"
                      }`}
                    >
                      {t.who}
                    </span>
                  </div>
                  <span className="col-span-2 row-start-2 flex h-[30px] min-w-0 items-center gap-[2px] sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    {trackBars(t.seed).map((height, bi) => (
                      <i
                        key={bi}
                        className="flex-1 rounded-[1px] opacity-50"
                        style={{
                          height: `${height}%`,
                          background:
                            "linear-gradient(var(--color-accent),var(--color-accent-2))",
                        }}
                      />
                    ))}
                  </span>
                  <span className="col-start-2 row-start-1 flex gap-1.5 sm:col-start-3">
                    <span
                      className={`grid h-[27px] w-[27px] place-items-center rounded-lg font-mono text-[10px] ${
                        t.mute
                          ? "bg-accent text-accent-contrast border border-transparent font-bold"
                          : "border-strong text-muted border"
                      }`}
                    >
                      M
                    </span>
                    <span
                      className={`grid h-[27px] w-[27px] place-items-center rounded-lg font-mono text-[10px] ${
                        t.solo
                          ? "bg-accent-2 text-accent-contrast border border-transparent font-bold"
                          : "border-strong text-muted border"
                      }`}
                    >
                      S
                    </span>
                  </span>
                </div>
              ))}
            </Reveal>
            <div className="flex min-w-0 flex-col gap-4">
              <Reveal
                delay={0.08}
                className="rounded-card border-subtle border p-6"
                style={{
                  background:
                    "linear-gradient(160deg,var(--color-surface-raised),#31213a)",
                }}
              >
                <div
                  className="bg-clip-text text-[44px] leading-none font-bold tracking-[-0.03em] text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(120deg,var(--color-accent),var(--color-accent-2))",
                  }}
                >
                  0 Revisions lost
                </div>
                <p className="text-muted mt-3 text-sm leading-relaxed">
                  Every stem and version lives in one shared project — no
                  &ldquo;final_final_v3.&rdquo;
                </p>
              </Reveal>
              <Reveal
                delay={0.14}
                className="rounded-card border-subtle border p-6"
                style={{
                  background:
                    "linear-gradient(160deg,var(--color-surface-raised),#31213a)",
                }}
              >
                <div
                  className="bg-clip-text text-[44px] leading-none font-bold tracking-[-0.03em] text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(120deg,var(--color-accent),var(--color-accent-2))",
                  }}
                >
                  &infin; Experiments
                </div>
                <p className="text-muted mt-3 text-sm leading-relaxed">
                  Fork any version into a new direction and keep going, with
                  attribution intact.
                </p>
              </Reveal>
            </div>
          </div>
        </Container>

        {/* VERSION HISTORY / LINEAGE */}
        <Container className="py-20 sm:py-24" id="history">
          <div className="grid items-center gap-14 lg:grid-cols-[1.06fr_0.94fr]">
            <div className="order-1 lg:order-2">
              <Reveal>
                <p className={kicker}>The story of the song</p>
              </Reveal>
              <Reveal delay={0.05}>
                <h2 className={h2}>
                  Nothing gets lost when a song{" "}
                  <em className="text-accent font-serif font-medium">grows</em>.
                </h2>
              </Reveal>
              <Reveal delay={0.1}>
                <p className={lede}>
                  Every accepted idea becomes a version you can play, compare,
                  or build on. Fork a track into a bolder direction and its
                  whole history travels with it — so the record of how it came
                  to be is never overwritten.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <AuthAwareLink
                  signedOut={{
                    href: "/sign-in",
                    label: "See a project's history",
                  }}
                  signedIn={{
                    href: "/projects",
                    label: "See a project's history",
                  }}
                  className={`${ctaSecondary} mt-8`}
                />
              </Reveal>
            </div>
            <Reveal className="order-2 lg:order-1">
              <ol>
                {lineage.map((node) => (
                  <li
                    key={node.ver + node.who}
                    className={`border-subtle relative grid grid-cols-[104px_1fr] gap-5 border-t py-5.5 ${
                      node.fork ? "pl-8" : ""
                    }`}
                  >
                    {node.fork && (
                      <span
                        aria-hidden="true"
                        className="absolute top-6 bottom-[22px] left-[7px] w-0.5"
                        style={{
                          background:
                            "linear-gradient(var(--color-berry),transparent)",
                        }}
                      />
                    )}
                    <div className="text-accent font-mono text-[11.5px] leading-[1.35] tracking-[0.04em]">
                      {node.ver}
                      <span className="text-muted mt-1 block text-[11px]">
                        {node.who}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-serif text-[22px] font-semibold tracking-[-0.01em]">
                        {node.title[0]}
                        <em className="text-accent-2 font-semibold">
                          {node.title[1]}
                        </em>
                        {node.title[2]}
                      </h3>
                      <p className="text-ink/90 mt-1.5 text-sm leading-relaxed">
                        {node.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </Container>

        {/* CREDITS */}
        <Container className="py-20 sm:py-24" id="credits">
          <div className="grid items-center gap-14 lg:grid-cols-[0.92fr_1.08fr]">
            <div>
              <Reveal>
                <p className={kicker}>Credit that sticks</p>
              </Reveal>
              <Reveal delay={0.05}>
                <h2 className={h2}>
                  Everyone who shaped it —{" "}
                  <em className="text-accent font-serif font-medium">
                    named, for good
                  </em>
                  .
                </h2>
              </Reveal>
              <Reveal delay={0.1}>
                <p className={lede}>
                  Every contribution is recorded like a line in the liner notes.
                  When a song gets remixed, forked, or shared, the credits come
                  with it — so the people who made it always get their name on
                  it.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <p className="text-muted mt-3.5 max-w-[48ch] text-lg leading-relaxed">
                  No spreadsheets. No forgotten features. No &ldquo;who played
                  that bassline again?&rdquo;
                </p>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <aside
                aria-label="Example credits sleeve"
                className="border-subtle relative rounded-[16px] border p-8 shadow-[0_40px_100px_-54px_#000]"
                style={{
                  background:
                    "radial-gradient(120% 130% at 100% 0%,rgba(231,122,166,0.14),transparent 55%),linear-gradient(165deg,var(--color-surface-raised),var(--color-surface-soft))",
                }}
              >
                <span
                  aria-hidden="true"
                  className="border-subtle pointer-events-none absolute inset-[11px] rounded-[6px] border opacity-60"
                />
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.01em]">
                  Midnight Loop
                </h3>
                <p className="text-muted mt-[7px] mb-5.5 font-mono text-[10.5px] tracking-[0.12em] uppercase">
                  Jam Session · Rev. 07 · Lo-fi house · 124 BPM
                </p>
                {credits.map((c) => (
                  <div
                    key={c.role + c.name}
                    className="border-subtle grid grid-cols-[auto_1fr] gap-x-[18px] gap-y-1.5 border-t py-[11px] text-[14.5px]"
                  >
                    <span className="text-accent-2 pt-[3px] font-mono text-[10.5px] tracking-[0.06em] uppercase">
                      {c.role}
                    </span>
                    <span className="font-medium">
                      {c.name}
                      {c.note && (
                        <span className="text-muted font-normal">
                          {" "}
                          · {c.note}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                <div className="border-strong text-muted mt-5 flex flex-wrap items-center gap-x-2 border-t border-dashed pt-4 font-mono text-[10.5px] tracking-[0.08em]">
                  Credits travel with every fork &amp; export ·{" "}
                  <b className="text-accent-2 font-semibold">
                    always attributed
                  </b>
                </div>
              </aside>
            </Reveal>
          </div>
        </Container>

        {/* FINAL CTA */}
        <Container className="py-20 sm:py-28">
          <Reveal
            className="rounded-card border-subtle flex flex-col items-center border px-6 py-14 text-center sm:px-16 sm:py-20"
            style={{
              background:
                "radial-gradient(120% 150% at 8% 0%,rgba(255,141,99,0.24),transparent 55%),radial-gradient(120% 150% at 100% 100%,rgba(231,122,166,0.22),transparent 55%),var(--color-surface-raised)",
            }}
          >
            <h2 className="max-w-[18ch] text-3xl font-bold tracking-[-0.035em] text-balance sm:text-5xl">
              The best part of a song is the people you{" "}
              <em className="text-accent font-serif font-medium">
                make it with
              </em>
              .
            </h2>
            <p className="text-muted mt-5 max-w-[44ch] text-lg leading-relaxed">
              Find collaborators who hear what you hear. Start something today.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <AuthAwareLink
                signedOut={{ href: "/sign-in", label: "Join the beta" }}
                signedIn={{ href: "/projects/new", label: "Create something" }}
                className={ctaPrimary}
              />
              <Link href="/explore" className={ctaSecondary}>
                Explore projects
              </Link>
            </div>
          </Reveal>
        </Container>
      </div>

      <FloatingCta />
    </>
  );
}
