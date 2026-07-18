import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Container } from "@/components/layout/container";
import { PublicMidiQuickPreview } from "@/features/public-midi/quick-preview-player.client";
import {
  ChallengeReportControl,
  ChallengeVoteControl,
} from "@/features/challenges/challenge-community-controls.client";
import {
  getPublicChallenge,
  getPublicChallengeEntry,
  listMyActiveChallengeVoteIds,
} from "@/server/repositories/challenges";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  entryId: z.uuid(),
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; entryId: string }>;
}): Promise<Metadata> {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return { title: "Challenge entry not found" };
  const entry = await getPublicChallengeEntry(
    parsed.data.slug,
    parsed.data.entryId,
  );
  return entry
    ? { title: `${entry.projectTitle} — challenge entry` }
    : { title: "Challenge entry not found" };
}

export default async function ChallengeEntryDetailPage({
  params,
}: {
  params: Promise<{ slug: string; entryId: string }>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const [challenge, entry] = await Promise.all([
    getPublicChallenge(parsed.data.slug),
    getPublicChallengeEntry(parsed.data.slug, parsed.data.entryId),
  ]);
  if (!challenge || !entry) notFound();
  const activeVoteIds = await listMyActiveChallengeVoteIds(challenge.id);
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <Link
          href={`/challenges/${challenge.slug}`}
          className="text-accent underline"
        >
          ← {challenge.title}
        </Link>
        <article className="mt-7 max-w-4xl">
          <p className="text-accent font-mono text-sm tracking-widest uppercase">
            Challenge-scoped exact entry
          </p>
          <h1 className="mt-3 text-4xl font-bold sm:text-6xl">
            {entry.projectTitle}
          </h1>
          <p className="text-accent-2 mt-4 text-xl font-semibold">
            {entry.entrantDisplayName} · @{entry.entrantUsername} · revision{" "}
            {entry.revisionNumber}
          </p>
          <p className="mt-5 text-lg">
            {entry.revisionMessage ?? "No revision note."}
          </p>
          <PublicMidiQuickPreview
            title={entry.projectTitle}
            durationMs={entry.durationMs}
            previewEndpoint={`/api/challenges/${challenge.slug}/entries/${entry.entryId}/preview`}
          />
          {entry.voteTotal !== null && (
            <p className="text-accent-2 mt-5 text-lg font-semibold">
              Final total: {entry.voteTotal}{" "}
              {entry.voteTotal === 1 ? "vote" : "votes"}
            </p>
          )}
          {challenge.acceptsVotes && (
            <ChallengeVoteControl
              entryId={entry.entryId}
              slug={challenge.slug}
              initiallyActive={activeVoteIds.includes(entry.entryId)}
            />
          )}
          <section
            className="border-subtle bg-surface-soft rounded-card mt-8 border p-6"
            aria-labelledby="attribution-heading"
          >
            <h2 id="attribution-heading" className="text-xl font-bold">
              Required attribution snapshots
            </h2>
            <ul className="mt-3 space-y-2">
              {entry.attributions.map((attribution) => (
                <li key={attribution.kind}>
                  <span className="text-muted capitalize">
                    {attribution.kind.replaceAll("_", " ")}:
                  </span>{" "}
                  {attribution.creditName}
                </li>
              ))}
            </ul>
          </section>
          <p className="border-subtle rounded-control mt-6 border p-4 text-sm">
            This endpoint authorizes browser-local listening for this challenge
            only. It offers no MIDI download, library reuse, fork, or editable
            copy, and it does not expose the source project workspace or
            history.
          </p>
          <ChallengeReportControl
            challengeId={challenge.id}
            entryId={entry.entryId}
            slug={challenge.slug}
          />
        </article>
      </Container>
    </main>
  );
}
