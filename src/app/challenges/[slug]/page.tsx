import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { ChallengeRules } from "@/features/challenges/challenge-rules";
import { challengePhaseMessage } from "@/features/challenges/lifecycle";
import { getPublicChallenge } from "@/server/repositories/challenges";

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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const challenge = await getPublicChallenge(slug);
  if (!challenge) notFound();
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
            <p className="text-muted mt-4">
              Challenge entry and voting controls are not part of this release
              slice.
            </p>
          </section>
        </article>
      </Container>
    </main>
  );
}
