import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FiHeadphones, FiPlus } from "react-icons/fi";
import { BrandMark } from "@/components/layout/brand-mark";
import { Reveal } from "@/components/ui/reveal.client";
import { AuthAwareLink } from "@/features/auth/auth-aware-link.client";
import { getViewerEntryPath } from "@/features/auth/destination";
import { getOptionalViewer } from "@/features/auth/guards";
import { describeChallengeConstraintsV1 } from "@/features/challenges/constraint-v1";
import { hasSupabasePublicEnvConfiguration } from "@/lib/env/public";
import { getFeaturedChallenge } from "@/server/repositories/challenges";
import { ChallengeGauges } from "./_components/challenge-gauges.client";
import { DiffMachine } from "./_components/diff-machine.client";
import { HeroCanvas } from "./_components/hero-canvas.client";
import { RadialClose } from "./_components/radial-close.client";
import { ScrollCue } from "./_components/scroll-cue";
import { SectionScroller } from "./_components/section-scroller.client";
import styles from "./_components/landing.module.css";

export const metadata: Metadata = {
  title: { absolute: "OpenMIDI - A MIDI Playground" },
  description:
    "Write MIDI in your browser and publish it to a public repository where anyone can open, listen, and remix it while your name stays on every note you wrote.",
};
export const dynamic = "force-dynamic";

// Decorative note figures for the library cards' mini piano rolls. Steps are
// out of 16, rows out of 8 — matching the mockup's flow() coordinates.
type Fig = readonly (readonly [step: number, len: number, row: number])[];
const SEED: Fig = [
  [0, 2, 6],
  [2, 1, 6],
  [4, 2, 5],
  [6, 1, 6],
  [8, 2, 6],
  [10, 1, 6],
  [12, 2, 5],
  [14, 2, 4],
];
const HALF: Fig = [
  [0, 4, 6],
  [4, 2, 6],
  [8, 4, 5],
  [12, 4, 4],
];
const REST: Fig = [
  [0, 3, 3],
  [4, 3, 2],
  [8, 3, 3],
  [12, 3, 1],
  [2, 1, 0],
  [6, 2, 0],
  [10, 1, 1],
];

function RollNotes({
  groups,
}: {
  groups: readonly { notes: Fig; color: string; dim?: boolean }[];
}) {
  return (
    <>
      {groups.flatMap((g, gi) =>
        g.notes.map(([s, l, row], i) => (
          <span
            key={`${gi}-${i}`}
            className={styles.mn}
            style={{
              left: `${(s / 16) * 100}%`,
              width: `calc(${(l / 16) * 100}% - 2px)`,
              top: `${(row / 8) * 100}%`,
              background: g.color,
              opacity: g.dim ? 0.4 : undefined,
            }}
          />
        )),
      )}
    </>
  );
}

export default async function Home() {
  const hasSupabase = hasSupabasePublicEnvConfiguration();
  if (hasSupabase) {
    const viewer = await getOptionalViewer();
    if (viewer) redirect(getViewerEntryPath(viewer));
  }
  const featured = hasSupabase ? await getFeaturedChallenge() : null;
  const featuredChallenge = featured?.challenge ?? null;
  return (
    <div className={styles.root} data-landing-scroll>
      <SectionScroller />
      {/* ================= HERO ================= */}
      <header className={styles.hero} id="top" data-snap>
        <HeroCanvas />
        <div className={styles.scrim} />

        <nav className={styles.nav} aria-label="Primary">
          <div className={`${styles.wrap} ${styles.navIn}`}>
            <a className={styles.brand} href="#top" aria-label="OpenMIDI home">
              <BrandMark gradientId="mk" />
              <span className={styles.brandWord}>
                <b>Open</b>
                <i>MIDI</i>
              </span>
            </a>
            <div className={styles.navLinks}>
              <a href="#library">The MIDI Library</a>
              <a href="#versioning">Versioning</a>
              <a href="#challenges">Challenges</a>
            </div>
            <AuthAwareLink
              signedOut={{ href: "/sign-in", label: "Sign In" }}
              signedIn={{ href: "/dashboard", label: "Open app" }}
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
            />
          </div>
        </nav>

        <div className={`${styles.wrap} ${styles.heroIn}`}>
          <Reveal>
            <p className={`${styles.kicker} ${styles.kickerGold}`}>
              A public playground for MIDI
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <h1>
              The song is
              <br />
              the <em className={styles.em}>source</em>.
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className={styles.lede}>
              Write MIDI in your browser and publish it to a public repository
              where anyone can open, listen, and remix/reuse it while your name
              stays on every note you wrote.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className={styles.ctaRow}>
              <AuthAwareLink
                signedOut={{ href: "/sign-in", label: "Create Something" }}
                signedIn={{ href: "/projects/new", label: "Create Something" }}
                className={`${styles.btn} ${styles.btnPrimary}`}
                icon={<FiPlus className={styles.btnI} aria-hidden="true" />}
              />
              <a className={`${styles.btn} ${styles.btnGhost}`} href="#library">
                <FiHeadphones className={styles.btnI} aria-hidden="true" />
                Listen in
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.24}>
            <div className={`${styles.heroMeta}`}>
              <span>Create</span>
              <span>Collab</span>
              <span>Compete</span>
            </div>
          </Reveal>
        </div>

        <div className={`${styles.wrap} ${styles.nowPlaying}`} data-now-playing>
          <span className={styles.np}>
            <span className={styles.pulse} />
            <b>nocturne · v3 · @nova</b>
          </span>
        </div>

        <ScrollCue href="#library" />
      </header>

      {/* ================= LIBRARY ================= */}
      <section className={styles.sec} id="library" data-snap>
        <div className={styles.wrap}>
          <div className={styles.head} style={{ maxWidth: "46rem" }}>
            <Reveal>
              <p className={styles.kicker}>The MIDI library</p>
            </Reveal>
            <Reveal delay={0.06}>
              <p className={styles.kickerSub}>
                <span>Public</span>
                <span>Free for anyone with an account</span>
                <span className={styles.attr}>
                  Every creator credited automatically
                </span>
              </p>
            </Reveal>
            <Reveal delay={0.12}>
              <h2>
                Every clip remembers{" "}
                <em className={styles.emGold}>where it came from</em>.
              </h2>
            </Reveal>
            <Reveal delay={0.18}>
              <p className={styles.lede}>
                Publish a bassline, a drum fill, a chord loop. Anyone can drop
                it into their project - and the credit travels with it,
                automatically, forever.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <p className={styles.lede}>
                Not a marketplace. An open library where every piece knows who
                wrote it and what it grew out of.
              </p>
            </Reveal>
          </div>

          <div className={styles.flow}>
            <Reveal className={styles.fl}>
              <div className={styles.flCard}>
                <div className={styles.flBar}>
                  <b>Rain Bassline</b>
                  <span className={styles.step}>v1</span>
                </div>
                <div className={styles.flRoll}>
                  <RollNotes
                    groups={[{ notes: SEED, color: "var(--berry)" }]}
                  />
                </div>
                <div className={styles.flBody}>
                  <p className={styles.flWhat}>
                    @mara writes it and publishes it to the library.
                  </p>
                  <div className={styles.credits}>
                    <p className={styles.creditsL}>Credit</p>
                    <p className={styles.cred}>
                      <span
                        className={styles.chip}
                        style={{ background: "var(--berry)" }}
                      />
                      <b>@mara</b>
                      <span className={styles.role}>wrote</span>
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal className={styles.fl} delay={0.08}>
              <div className={styles.flCard}>
                <div className={styles.flBar}>
                  <b>Rain Bassline</b>
                  <span className={styles.step}>v2 · halftime</span>
                </div>
                <div className={styles.flRoll}>
                  <RollNotes
                    groups={[{ notes: HALF, color: "var(--berry)" }]}
                  />
                </div>
                <div className={styles.flBody}>
                  <p className={styles.flWhat}>
                    @dorian halves the tempo and republishes the new version.
                  </p>
                  <div className={styles.credits}>
                    <p className={styles.creditsL}>Credit</p>
                    <p className={styles.cred}>
                      <span
                        className={styles.chip}
                        style={{ background: "var(--berry)" }}
                      />
                      <b>@mara</b>
                      <span className={styles.role}>wrote</span>
                    </p>
                    <p className={styles.cred}>
                      <span
                        className={styles.chip}
                        style={{ background: "var(--coral)" }}
                      />
                      <b>@dorian</b>
                      <span className={styles.role}>adapted</span>
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal className={styles.fl} delay={0.16}>
              <div className={styles.flCard}>
                <div className={styles.flBar}>
                  <b>Nocturne</b>
                  <span className={styles.step}>v3</span>
                </div>
                <div className={styles.flRoll}>
                  <RollNotes
                    groups={[
                      { notes: REST, color: "var(--coral)", dim: true },
                      { notes: HALF, color: "var(--berry)" },
                    ]}
                  />
                </div>
                <div className={styles.flBody}>
                  <p className={styles.flWhat}>
                    @nova drops v2 into a whole arrangement. Nobody typed a
                    credit.
                  </p>
                  <div className={styles.credits}>
                    <p className={styles.creditsL}>Credit</p>
                    <p className={styles.cred}>
                      <span
                        className={styles.chip}
                        style={{ background: "var(--berry)" }}
                      />
                      <b>@mara</b>
                      <span className={styles.role}>wrote</span>
                    </p>
                    <p className={styles.cred}>
                      <span
                        className={styles.chip}
                        style={{ background: "var(--coral)" }}
                      />
                      <b>@dorian</b>
                      <span className={styles.role}>adapted</span>
                    </p>
                    <p className={styles.cred}>
                      <span
                        className={styles.chip}
                        style={{ background: "var(--gold)" }}
                      />
                      <b>@nova</b>
                      <span className={styles.role}>used</span>
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal>
            <span className={styles.licWrap}>
              <a
                className={styles.licStrip}
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer noopener"
                aria-describedby="lic-tip"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6.6"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <path
                    d="M10 6.2a2.6 2.6 0 1 0 0 3.6"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                <span>
                  CC BY 4.0 — reuse it anywhere, just keep the <b>names</b>{" "}
                  attached
                </span>
                <svg
                  className={styles.licQ}
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6.6"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M6.2 6.1a1.85 1.85 0 1 1 2.1 2.2v1"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                  <circle cx="8.3" cy="11.4" r="0.75" fill="currentColor" />
                </svg>
              </a>
              <span className={styles.tip} id="lic-tip" role="tooltip">
                <b>Every clip published to OpenMIDI uses CC BY 4.0.</b>
                It is the default, and the only option — so you never have to
                read the small print before reusing something. Anyone may copy
                it, change it, and use it commercially, as long as the original
                creators stay credited. We attach those credits for you.
                <span className={styles.tipGo}>
                  Read the full licence at creativecommons.org →
                </span>
              </span>
            </span>
          </Reveal>
        </div>

        <ScrollCue href="#versioning" />
      </section>

      {/* ================= DIFF ================= */}
      <section className={styles.sec} id="versioning" data-snap>
        <DiffMachine />
        <ScrollCue href="#challenges" />
      </section>

      {/* ================= BRIEF / CHALLENGE ================= */}
      <section className={styles.sec} id="challenges" data-snap>
        <div className={`${styles.wrap} ${styles.briefGrid}`}>
          <div className={styles.head}>
            <Reveal>
              <p className={styles.kicker}>Competitive Challenges</p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2>
                Constraints foster <em className={styles.em}>creativity</em>
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className={styles.lede}>
                Compete against other producers in unique challenges that change
                every week. Match a theme, build a track under defined
                constraints, or remix a provided clip. The only goal is to
                submit something that&apos;s fun to listen to, and that
                you&apos;re proud of.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <p className={styles.lede}>
                The best submissions are chosed by the community.{" "}
                <strong style={{ color: "var(--color-text)", fontWeight: 600 }}>
                  Winners unlock permanent badges
                </strong>{" "}
                to display on their profile, and wherever they post or fork a
                project.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.12}>
            <div className={styles.ticket}>
              <div className={styles.ticketTop}>
                <div className={styles.ticketEyebrow}>
                  <span className={styles.live}>
                    <span className={styles.pulse} />
                    {featured?.label ?? "Challenge desk"}
                  </span>
                  <span className={styles.clock}>
                    {featuredChallenge
                      ? new Date(
                          featuredChallenge.votingClosesAt,
                        ).toLocaleDateString()
                      : "No challenge scheduled"}
                  </span>
                </div>
                <p className={styles.ticketTitle}>
                  {featuredChallenge?.title ??
                    "The next creative constraint is being tuned"}
                </p>
                <p className={styles.ticketSub}>
                  {featuredChallenge?.prompt ??
                    "Browse completed sessions while the next administrator-curated challenge is prepared."}
                </p>
                <div className={styles.stakes}>
                  <span className={styles.stake}>
                    <b>{featuredChallenge?.versionNumber ?? "—"}</b> rules
                    version
                  </span>
                  <span className={styles.stake}>
                    <b>
                      {featuredChallenge
                        ? describeChallengeConstraintsV1(
                            featuredChallenge.constraints,
                          ).length
                        : "—"}
                    </b>{" "}
                    exact constraints
                  </span>
                  <span className={styles.stake}>
                    <b>{featuredChallenge?.judgingMode ?? "curated"}</b> judging
                  </span>
                </div>
                <Link
                  href={
                    featuredChallenge
                      ? `/challenges/${featuredChallenge.slug}`
                      : "/challenges"
                  }
                  className={styles.clock}
                >
                  {featuredChallenge
                    ? "Open canonical challenge →"
                    : "Browse challenges →"}
                </Link>
              </div>
              <ChallengeGauges constraints={featuredChallenge?.constraints} />
            </div>
          </Reveal>
        </div>

        <div className={styles.wrap}>
          <Reveal className={styles.loot}>
            <div className={styles.lootHead}>
              <p className={styles.lootCap}>Rewards</p>
              <p className={styles.lootNote}>
                Unlock permanent badges to display on your profile and projects!
              </p>
            </div>

            <div className={styles.lootRow}>
              <div className={`${styles.medal} ${styles.won}`}>
                <span className={styles.medalFace}>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M7 4h10v5a5 5 0 0 1-10 0V4Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 14v4M9 20h6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className={styles.medalName}>Round winner</span>
                <span className={styles.medalSub}>Guest pick</span>
              </div>

              <div className={`${styles.medal} ${styles.won}`}>
                <span className={styles.medalFace}>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.8 6.7 19.7l1.1-6.1L3.4 9.4l6-.8L12 3Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.medalName}>People&apos;s pick</span>
                <span className={styles.medalSub}>Voted by entrants</span>
              </div>

              <div className={styles.medal}>
                <span className={styles.medalFace}>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 3 21 12l-9 9-9-9 9-9Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.medalName}>Finalist</span>
                <span className={styles.medalSub}>Top ten</span>
              </div>

              <div className={styles.medal}>
                <span className={styles.medalFace}>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 12.5 9.5 18 20 6.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.medalName}>Shipped it</span>
                <span className={styles.medalSub}>Entered before the bell</span>
              </div>

              <div className={styles.titleCard}>
                <p className={styles.titleCap}>Unlocked title</p>
                <p className={styles.titleLine}>
                  <span className={styles.handle}>@nova</span>
                </p>
                <p className={styles.titleName}>Two-time round winner</p>
                <p className={styles.titleFoot}>
                  Shown wherever you post, fork, or enter.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <ScrollCue href="#close" />
      </section>

      {/* ================= CLOSE ================= */}
      <section className={styles.close} id="close" data-snap>
        <RadialClose />
        <div className={styles.closeScrim} />
        <div className={`${styles.wrap} ${styles.closeIn}`}>
          <Reveal>
            <p
              className={`${styles.kicker} ${styles.kickerGold}`}
              style={{ justifyContent: "center" }}
            >
              openmidi.app
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2>
              Publish the notes. See what comes{" "}
              <em className={styles.em}>back</em>.
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className={styles.lede}>
              Post a simple jingle tonight and wake up to an accompanying
              arrangement tomorrow.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className={styles.ctaRow}>
              <AuthAwareLink
                signedOut={{ href: "/sign-in", label: "Join the beta" }}
                signedIn={{ href: "/projects/new", label: "Create Something" }}
                className={`${styles.btn} ${styles.btnPrimary}`}
              />
            </div>
          </Reveal>
        </div>
      </section>

      <footer className={`${styles.wrap} ${styles.footer}`}>
        <span>OpenMIDI — the song is the source.</span>
        <span className={styles.footLinks}>
          <a href="#library">The MIDI Library</a>
          <a href="#versioning">Versioning</a>
          <a href="#challenges">Challenges</a>
        </span>
      </footer>
    </div>
  );
}
