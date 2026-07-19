import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { ChallengeRules } from "@/features/challenges/challenge-rules";
import { ChallengeEntryPanel } from "@/features/challenges/challenge-entry-panel.client";
import {
  publicChallengeAwardTargetQuerySchema,
  publicChallengeEntryCursorSchema,
} from "@/features/challenges/entry-contract";
import {
  ChallengeReportControl,
  ChallengeVoteControl,
} from "@/features/challenges/challenge-community-controls.client";
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
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <Link href="/challenges" className="text-accent underline">
          ← All challenges
        </Link>
        <article className={`challenge-${challenge.presentationCode} mt-6`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="border-accent text-accent rounded-full border px-4 py-1 text-sm font-semibold tracking-wide uppercase">
              {phase}
            </span>
            <span className="text-muted">
              Constraint schema v1 · rules hash{" "}
              {challenge.constraintsSha256.slice(0, 8)}
            </span>
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold sm:text-6xl">
            {challenge.title}
          </h1>
          <p className="text-accent-2 mt-4 max-w-3xl text-xl font-semibold">
            {challenge.prompt}
          </p>
          <p className="mt-6 max-w-3xl text-lg whitespace-pre-line">
            {challenge.description}
          </p>
          {challenge.state === "cancelled" && (
            <p className="border-danger text-danger rounded-control mt-6 border p-4">
              This challenge was cancelled. {challenge.cancellationNote}
            </p>
          )}
          <section
            className="border-subtle bg-surface rounded-card mt-10 grid gap-5 border p-6 sm:grid-cols-2"
            aria-labelledby="schedule-heading"
          >
            <h2
              id="schedule-heading"
              className="text-2xl font-bold sm:col-span-2"
            >
              Frozen schedule
            </h2>
            {[
              ["Opens", challenge.opensAt],
              ["Submissions close", challenge.submissionsCloseAt],
              ["Voting opens", challenge.votingOpensAt],
              ["Voting closes", challenge.votingClosesAt],
              ["Results expected", challenge.resultsExpectedAt],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-muted text-sm">{label}</p>
                <time dateTime={value} className="font-semibold">
                  {new Date(value).toLocaleString()}
                </time>
              </div>
            ))}
          </section>
          <div className="mt-10">
            <ChallengeRules constraints={challenge.constraints} />
          </div>
          <section className="mt-10" aria-labelledby="credits-heading">
            <h2 id="credits-heading" className="text-2xl font-bold">
              Host and judges
            </h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {challenge.judges.map((judge) => (
                <li
                  key={judge.position}
                  className="border-subtle bg-surface rounded-full border px-5 py-3"
                >
                  <span className="text-muted mr-2 capitalize">
                    {judge.role}
                  </span>
                  {judge.creditName}
                </li>
              ))}
            </ul>
          </section>
          {challenge.starter && (
            <section
              className="border-subtle bg-surface rounded-card mt-10 border p-6"
              aria-labelledby="starter-heading"
            >
              <h2 id="starter-heading" className="text-2xl font-bold">
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
                  href={`/projects/${challenge.starter.projectId}`}
                  className="border-strong mt-5 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
                >
                  Preview public starter
                </Link>
              ) : (
                <p className="text-muted mt-4">
                  The historical starter snapshot remains, but the source is not
                  currently available to open.
                </p>
              )}
            </section>
          )}
          <section className="border-subtle bg-surface-soft rounded-card mt-10 border p-6">
            <h2 className="text-xl font-bold">Eligibility and use</h2>
            <p className="mt-3 whitespace-pre-line">
              {challenge.eligibilityTerms}
            </p>
          </section>
          <ChallengeReportControl
            challengeId={challenge.id}
            slug={challenge.slug}
          />
          {awardTarget && (
            <section
              id={`entry-${awardTarget.entryId}`}
              tabIndex={-1}
              className="border-accent bg-surface-raised rounded-card mt-10 border p-6 sm:p-8"
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
                className="border-strong mt-5 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
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
            <p className="border-subtle bg-surface-soft rounded-control mt-10 border p-5">
              Preflight and exact entry submission open with the challenge.
            </p>
          ) : null}
          {(challenge.phase === "voting" ||
            challenge.phase === "completed") && (
            <section className="mt-10" aria-labelledby="public-entries-heading">
              <h2 id="public-entries-heading" className="text-2xl font-bold">
                Challenge entries
              </h2>
              {publicEntries.length ? (
                <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                  {publicEntries.map((entry) => (
                    <li
                      key={entry.entryId}
                      id={
                        awardTarget?.entryId === entry.entryId
                          ? undefined
                          : `entry-${entry.entryId}`
                      }
                      className="border-subtle bg-surface rounded-card border p-5"
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
                        className="border-strong mt-4 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
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
              className="border-accent bg-surface-raised rounded-card mt-10 border p-6 sm:p-8"
              aria-labelledby="challenge-results-heading"
            >
              <p className="text-accent font-mono text-xs tracking-widest uppercase">
                Permanent result Â· version {challenge.result.version}
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
                      className="border-subtle rounded-control border p-4"
                    >
                      <strong>
                        #{placement.place} Â· {placement.label}
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
                    className="border-subtle rounded-control border p-4"
                  >
                    <strong>{favorite.projectTitle}</strong>{" "}
                    <span className="text-muted">
                      by @{favorite.entrantUsername} Â· {favorite.voteTotal}{" "}
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
