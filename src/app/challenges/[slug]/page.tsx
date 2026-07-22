import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/ui/reveal.client";
import {
  ChallengeCountdown,
  formatRemainingLong,
  nextChallengeMilestone,
} from "@/features/challenges/challenge-countdown";
import { ChallengeRules } from "@/features/challenges/challenge-rules";
import { ChallengeTimeline } from "@/features/challenges/challenge-timeline";
import { ChallengeEntryPanel } from "@/features/challenges/challenge-entry-panel.client";
import {
  publicChallengeAwardTargetQuerySchema,
  publicChallengeEntryCursorSchema,
} from "@/features/challenges/entry-contract";
import { ChallengeVoteControl } from "@/features/challenges/challenge-community-controls.client";
import { challengePhaseMessage } from "@/features/challenges/lifecycle";
import { challengeEntryPageHref } from "@/features/challenges/rotation";
import {
  getMyChallengeEntry,
  getPublicChallenge,
  getPublicChallengeAwardTarget,
  listMyActiveChallengeVoteIds,
  listMyChallengeRevisionOptions,
  listPublicChallengeEntries,
} from "@/server/repositories/challenges";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getPublicChallenge(slug);
  return challenge
    ? { title: challenge.title, description: challenge.prompt }
    : { title: "Challenge not found" };
}

export default async function ChallengeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const hasAwardTarget =
    query.result !== undefined || query.entry !== undefined;
  const parsedAwardTarget = publicChallengeAwardTargetQuerySchema.safeParse({
    result: query.result,
    entry: query.entry,
  });
  if (hasAwardTarget && !parsedAwardTarget.success) notFound();
  const parsedCursor = publicChallengeEntryCursorSchema.safeParse({
    rotationBucket: query.rotationBucket,
    rotationKey: query.afterRotationKey,
    entryId: query.afterEntryId,
  });
  const cursor = parsedCursor.success ? parsedCursor.data : null;
  const challenge = await getPublicChallenge(slug);
  if (!challenge) notFound();
  const [
    revisionOptions,
    myEntry,
    publicEntryPage,
    activeVoteIds,
    awardTarget,
  ] = await Promise.all([
    challenge.phase === "open"
      ? listMyChallengeRevisionOptions(challenge.id)
      : Promise.resolve([]),
    getMyChallengeEntry(challenge.id),
    listPublicChallengeEntries(slug, cursor),
    listMyActiveChallengeVoteIds(challenge.id),
    parsedAwardTarget.success
      ? getPublicChallengeAwardTarget(
          slug,
          parsedAwardTarget.data.result,
          parsedAwardTarget.data.entry,
        )
      : Promise.resolve(null),
  ]);
  if (
    parsedAwardTarget.success &&
    (!awardTarget || challenge.result?.id !== awardTarget.resultId)
  )
    notFound();
  const publicEntries = publicEntryPage.entries;
  const phase = challengePhaseMessage({
    phase: challenge.phase,
    votingOpensAt: challenge.votingOpensAt,
    votingClosesAt: challenge.votingClosesAt,
  });
  const milestone = nextChallengeMilestone(challenge);
  const opensIn = formatRemainingLong(challenge.opensAt);
  const closedLabel =
    challenge.state === "cancelled"
      ? "Cancelled"
      : challenge.phase === "completed"
        ? "Results published"
        : phase;

  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10">
        <Reveal>
          <Link
            href="/challenges"
            prefetch={false}
            className="text-muted hover:text-accent group inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
          >
            <FiArrowLeft
              aria-hidden="true"
              className="transition-transform group-hover:-translate-x-0.5"
            />
            All challenges
          </Link>
        </Reveal>

        <article className={`challenge-${challenge.presentationCode}`}>
          <Reveal delay={0.04} className="mt-4">
            <header className="challenge-hero rounded-card relative overflow-hidden p-5 sm:p-8">
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-start sm:gap-8">
                <div>
                  <span className="border-accent/45 bg-accent/12 text-accent inline-flex rounded-full border px-3 py-0.5 font-mono text-[10.5px] tracking-[0.18em] uppercase">
                    {phase}
                  </span>
                  <h1 className="mt-4 text-3xl font-bold tracking-[-0.035em] text-balance sm:text-5xl">
                    {challenge.title}
                  </h1>
                  <p className="text-accent-2 mt-3 text-lg font-semibold sm:text-xl">
                    {challenge.prompt}
                  </p>
                  <p className="text-muted mt-5 max-w-2xl leading-relaxed whitespace-pre-line">
                    {challenge.description}
                  </p>
                </div>
                <div className="grid gap-4">
                  <ChallengeCountdown
                    target={milestone}
                    closedLabel={closedLabel}
                  />
                  <ul className="grid gap-1.5 text-sm">
                    {challenge.judges.map((judge) => (
                      <li key={judge.position}>
                        <span className="text-muted font-mono text-[10.5px] tracking-[0.14em] uppercase">
                          {judge.role === "host" ? "Hosted by" : "Judge"}
                        </span>{" "}
                        <span className="text-ink font-semibold">
                          {judge.creditName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="border-subtle text-muted/80 mt-6 border-t pt-5 text-xs leading-relaxed whitespace-pre-line">
                <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase">
                  Eligibility and use ·{" "}
                </span>
                {challenge.eligibilityTerms}
              </p>

              {challenge.state === "cancelled" && (
                <p className="border-danger/50 bg-danger/10 text-danger rounded-control mt-5 border p-4">
                  This challenge was cancelled. {challenge.cancellationNote}
                </p>
              )}
            </header>
          </Reveal>

          <Reveal delay={0.08} className="mt-4">
            <ChallengeTimeline challenge={challenge} />
          </Reveal>

          <Reveal delay={0.12} className="mt-8">
            <ChallengeRules constraints={challenge.constraints} />
          </Reveal>

          {challenge.starter && (
            <Reveal
              as="section"
              delay={0.2}
              className="dash-card rounded-card mt-8 p-5 sm:p-6"
              aria-labelledby="starter-heading"
            >
              <h2
                id="starter-heading"
                className="text-muted font-mono text-[10.5px] tracking-[0.2em] uppercase"
              >
                Exact starter revision
              </h2>
              <p className="mt-3">
                <strong>{challenge.starter.projectTitle}</strong> by{" "}
                {challenge.starter.creatorCreditName} · revision{" "}
                {challenge.starter.revisionNumber} ·{" "}
                {challenge.starter.licenseCode}
              </p>
              {challenge.starter.available ? (
                <Link
                  prefetch={false}
                  href={`/projects/${challenge.starter.projectId}`}
                  className="border-strong hover:border-accent hover:text-accent mt-5 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold transition-colors"
                >
                  Preview public starter
                </Link>
              ) : (
                <p className="text-muted mt-4">
                  The historical starter snapshot remains, but the source is not
                  currently available to open.
                </p>
              )}
            </Reveal>
          )}
          {awardTarget && (
            <section
              id={`entry-${awardTarget.entryId}`}
              tabIndex={-1}
              className="dash-card dash-card-lit rounded-card relative mt-8 p-5 sm:p-6"
              aria-labelledby="award-source-entry-heading"
            >
              <p className="text-accent font-mono text-xs tracking-widest uppercase">
                Award source · permanent result version{" "}
                {awardTarget.resultVersion}
              </p>
              <h2
                id="award-source-entry-heading"
                className="mt-2 text-3xl font-bold"
              >
                Exact award entry
              </h2>
              <p className="mt-4 text-lg">
                <strong>{awardTarget.projectTitle}</strong> by @
                {awardTarget.entrantUsername}
              </p>
              <p className="text-muted mt-2">
                Revision {awardTarget.revisionNumber} · finalized with result{" "}
                <time dateTime={awardTarget.resultFinalizedAt}>
                  {new Date(awardTarget.resultFinalizedAt).toLocaleString()}
                </time>
              </p>
              {awardTarget.voteTotal !== null && (
                <p className="text-accent-2 mt-3 font-semibold">
                  {awardTarget.voteTotal}{" "}
                  {awardTarget.voteTotal === 1 ? "vote" : "votes"}
                </p>
              )}
              <Link
                href={`/challenges/${challenge.slug}/entries/${awardTarget.entryId}`}
                className="border-strong hover:border-accent hover:text-accent mt-5 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold transition-colors"
              >
                Hear exact entry
              </Link>
            </section>
          )}
          {challenge.phase === "open" ? (
            <ChallengeEntryPanel
              challengeId={challenge.id}
              challengeVersionId={challenge.currentVersionId}
              slug={challenge.slug}
              options={revisionOptions}
              myEntry={myEntry}
            />
          ) : challenge.phase === "scheduled" ? (
            <p className="challenge-cue rounded-card mx-auto mt-8 max-w-2xl p-5 text-center text-lg font-semibold sm:p-6 sm:text-xl">
              {opensIn ? (
                <>
                  <span className="text-muted">Submissions open in </span>
                  <span className="from-accent to-accent-2 bg-linear-to-r bg-clip-text leading-[1.3] text-transparent">
                    {opensIn}
                  </span>
                </>
              ) : (
                <span className="text-accent">Submissions open shortly.</span>
              )}
            </p>
          ) : null}
          {(challenge.phase === "voting" ||
            challenge.phase === "completed") && (
            <section className="mt-8" aria-labelledby="public-entries-heading">
              <h2
                id="public-entries-heading"
                className="text-muted px-1 font-mono text-[10.5px] tracking-[0.2em] uppercase"
              >
                Challenge entries
              </h2>
              {publicEntries.length ? (
                <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                  {publicEntries.map((entry) => (
                    <li
                      key={entry.entryId}
                      id={
                        awardTarget?.entryId === entry.entryId
                          ? undefined
                          : `entry-${entry.entryId}`
                      }
                      className="dash-card dash-card-action rounded-card p-5"
                    >
                      <p className="text-accent font-mono text-xs tracking-widest uppercase">
                        @{entry.entrantUsername} · revision{" "}
                        {entry.revisionNumber}
                      </p>
                      <h3 className="mt-2 text-xl font-bold">
                        {entry.projectTitle}
                      </h3>
                      <p className="text-muted mt-2 text-sm">
                        {entry.revisionMessage ?? "No revision note."}
                      </p>
                      {entry.voteTotal !== null && (
                        <p className="text-accent-2 mt-3 font-semibold">
                          {entry.voteTotal}{" "}
                          {entry.voteTotal === 1 ? "vote" : "votes"}
                        </p>
                      )}
                      <Link
                        href={`/challenges/${challenge.slug}/entries/${entry.entryId}`}
                        className="border-strong hover:border-accent hover:text-accent mt-4 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold transition-colors"
                      >
                        Hear exact entry
                      </Link>
                      {challenge.acceptsVotes && (
                        <ChallengeVoteControl
                          entryId={entry.entryId}
                          slug={challenge.slug}
                          initiallyActive={activeVoteIds.includes(
                            entry.entryId,
                          )}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted mt-4">
                  No moderation-visible active entries are available.
                </p>
              )}
              {publicEntryPage.nextCursor && (
                <Link
                  href={challengeEntryPageHref({
                    slug: challenge.slug,
                    rotationBucket: publicEntryPage.rotationBucket,
                    rotationKey: publicEntryPage.nextCursor.rotationKey,
                    entryId: publicEntryPage.nextCursor.entryId,
                  })}
                  className="border-strong mt-6 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
                >
                  Next entries →
                </Link>
              )}
            </section>
          )}
          {challenge.result && (
            <section
              className="dash-card dash-card-lit rounded-card relative mt-8 p-5 sm:p-6"
              aria-labelledby="challenge-results-heading"
            >
              <p className="text-accent font-mono text-xs tracking-widest uppercase">
                Permanent result · version {challenge.result.version}
              </p>
              <h2
                id="challenge-results-heading"
                className="mt-2 text-3xl font-bold"
              >
                Official results
              </h2>
              <p className="mt-4 whitespace-pre-line">
                {challenge.result.note}
              </p>
              <h3 className="mt-7 text-xl font-bold">Official placements</h3>
              {challenge.result.placements.length ? (
                <ol className="mt-3 space-y-3">
                  {challenge.result.placements.map((placement) => (
                    <li
                      key={placement.entryId}
                      className="border-subtle bg-surface-soft/50 rounded-control border p-4"
                    >
                      <strong>
                        #{placement.place} · {placement.label}
                      </strong>{" "}
                      <span className="text-muted">
                        {placement.projectTitle} by @{placement.entrantUsername}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted mt-3">
                  This community challenge has no official judged placements.
                </p>
              )}
              <h3 className="mt-7 text-xl font-bold">Community Favorite</h3>
              <ul className="mt-3 space-y-3">
                {challenge.result.communityFavorites.map((favorite) => (
                  <li
                    key={favorite.entryId}
                    className="border-subtle bg-surface-soft/50 rounded-control border p-4"
                  >
                    <strong>{favorite.projectTitle}</strong>{" "}
                    <span className="text-muted">
                      by @{favorite.entrantUsername} · {favorite.voteTotal}{" "}
                      {favorite.voteTotal === 1 ? "vote" : "votes"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted mt-5 text-sm">
                Finalized{" "}
                {new Date(challenge.result.finalizedAt).toLocaleString()}. Every
                highest included-vote tie is shown.
              </p>
            </section>
          )}
        </article>
      </Container>
    </main>
  );
}
