import Link from "next/link";
import { FiArrowUpRight, FiAward } from "react-icons/fi";
import type { PublicProfileAward } from "./contract";
import { getCatalogPresentation } from "./catalog-presentation";

const FEATURED_AWARD_COUNT = 3;

export function awardBasisText(award: PublicProfileAward) {
  if (award.awardBasis === "community_favorite")
    return "Highest final community vote total";
  if (award.awardBasis === "official_winner")
    return `Official winner · ${award.placementLabel}`;
  return `Official placement #${award.place} · ${award.placementLabel}`;
}

function TrophyItem({ award }: { award: PublicProfileAward }) {
  const presentation = getCatalogPresentation(award.presentationCode);
  if (!presentation) return null;
  const { Icon } = presentation;
  const basis = awardBasisText(award);
  const headingId = `trophy-${award.id}`;

  return (
    <article
      aria-labelledby={headingId}
      className={`${presentation.frameClassName} bg-surface/35 hover:bg-ink/[0.05] rounded-control relative flex items-start gap-3 border p-3 transition-colors`}
    >
      <span
        aria-hidden="true"
        className={`${presentation.iconClassName} border-subtle bg-surface/80 grid size-9 shrink-0 place-items-center rounded-full border`}
      >
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <h3 id={headingId} className="truncate text-sm font-bold">
          {award.badgeName}
        </h3>
        <p className="text-accent mt-0.5 text-xs font-semibold">{basis}</p>
        <p className="text-muted mt-1 line-clamp-2 text-xs leading-relaxed">
          {award.challengeTitle} · {award.projectTitle}, revision{" "}
          {award.revisionNumber}
        </p>
      </div>
      <Link
        href={award.challengeHref}
        aria-label={`${award.badgeName} for ${award.challengeTitle}: ${basis}. View permanent result`}
        className="border-subtle text-muted hover:border-accent-2 hover:text-accent-2 relative z-10 grid size-11 shrink-0 place-items-center rounded-full border transition-colors"
        title="View permanent result"
      >
        <FiArrowUpRight aria-hidden="true" />
      </Link>
    </article>
  );
}

function TrophyList({ awards }: { awards: PublicProfileAward[] }) {
  return (
    <ul className="grid gap-2">
      {awards.map((award) => (
        <li key={award.id}>
          <TrophyItem award={award} />
        </li>
      ))}
    </ul>
  );
}

export function TrophyCase({
  awards,
  nextHref,
}: {
  awards: PublicProfileAward[];
  nextHref: string | null;
}) {
  const featured = awards.slice(0, FEATURED_AWARD_COUNT);
  const additional = awards.slice(FEATURED_AWARD_COUNT);

  return (
    <section
      aria-labelledby="trophy-case-heading"
      className="border-subtle min-w-0 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
    >
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2
          id="trophy-case-heading"
          className="text-xl font-bold tracking-[-0.025em]"
        >
          Trophy Case
        </h2>
      </div>

      {awards.length > 0 ? (
        <div className="mt-3">
          <TrophyList awards={featured} />
          {additional.length > 0 && (
            <details className="mt-2">
              <summary className="text-muted hover:text-accent flex min-h-11 items-center text-sm font-semibold transition-colors">
                Show {additional.length} more{" "}
                {additional.length === 1 ? "award" : "awards"}
              </summary>
              <div className="pt-2">
                <TrophyList awards={additional} />
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="text-muted mt-3 flex items-center gap-2 text-sm">
          <FiAward aria-hidden="true" className="shrink-0" />
          <p>Awards earned in completed challenges will appear here.</p>
        </div>
      )}

      {nextHref && (
        <Link
          className="text-muted hover:text-accent mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold transition-colors"
          href={nextHref}
        >
          Next awards
          <FiArrowUpRight aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
