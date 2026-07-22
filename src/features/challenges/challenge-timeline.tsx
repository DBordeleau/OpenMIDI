type Stage = { label: string; at: string; detail?: string };

function short(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function exact(value: string) {
  return new Date(value).toLocaleString();
}

/**
 * The frozen schedule as a track you read left to right, rather than five
 * labelled datetimes in a grid. Voting collapses into one node carrying its
 * range — the opens/closes pair was two of the five rows and never needed to be
 * two stops.
 */
export function challengeTimelineStages(
  challenge: {
    opensAt: string;
    submissionsCloseAt: string;
    votingOpensAt: string;
    votingClosesAt: string;
    resultsExpectedAt: string;
  },
  now = Date.now(),
) {
  const stages: Stage[] = [
    { label: "Opens", at: challenge.opensAt },
    { label: "Submissions close", at: challenge.submissionsCloseAt },
    {
      label: "Voting",
      at: challenge.votingClosesAt,
      detail: `${short(challenge.votingOpensAt)} – ${short(challenge.votingClosesAt)}`,
    },
    { label: "Results", at: challenge.resultsExpectedAt },
  ];

  const start = new Date(challenge.opensAt).getTime();
  const end = new Date(challenge.resultsExpectedAt).getTime();
  const progress =
    end > start ? Math.min(Math.max((now - start) / (end - start), 0), 1) : 0;
  const reached = stages.map((stage) => now >= new Date(stage.at).getTime());
  // The first stage not yet reached is the one in play.
  const currentIndex = reached.findIndex((done) => !done);

  return { stages, progress, reached, currentIndex };
}

export function ChallengeTimeline({
  challenge,
}: {
  challenge: Parameters<typeof challengeTimelineStages>[0];
}) {
  const { stages, progress, reached, currentIndex } =
    challengeTimelineStages(challenge);

  return (
    <section
      className="dash-card rounded-card relative p-5 sm:p-6"
      aria-labelledby="challenge-schedule-heading"
    >
      <h2
        id="challenge-schedule-heading"
        className="text-muted font-mono text-[10.5px] tracking-[0.2em] uppercase"
      >
        Frozen schedule
      </h2>

      <ol className="relative mt-5 grid gap-5 sm:grid-cols-4 sm:gap-4">
        {/* Rail + fill. Two orientations, so two elements — each hidden at the
            other breakpoint rather than one element fighting both axes. */}
        <span
          aria-hidden="true"
          className="bg-ink/10 absolute top-1 bottom-1 left-[5px] w-px sm:hidden"
        />
        <span
          aria-hidden="true"
          className="from-accent to-accent-2 absolute top-1 left-[5px] w-px bg-linear-to-b sm:hidden"
          style={{ height: `${progress * 100}%` }}
        />
        <span
          aria-hidden="true"
          className="bg-ink/10 absolute top-[5px] right-0 left-0 hidden h-px sm:block"
        />
        <span
          aria-hidden="true"
          className="from-accent to-accent-2 absolute top-[5px] left-0 hidden h-px bg-linear-to-r sm:block"
          style={{ width: `${progress * 100}%` }}
        />

        {stages.map((stage, index) => {
          const done = reached[index];
          const current = index === currentIndex;
          return (
            <li
              key={stage.label}
              className="relative flex gap-3 sm:block"
              aria-current={current ? "step" : undefined}
            >
              <span
                aria-hidden="true"
                className={`mt-1 block size-[11px] shrink-0 rounded-full border-2 sm:mt-0 ${
                  current
                    ? "border-accent bg-accent shadow-[0_0_0_4px_rgb(255_141_99/0.22)]"
                    : done
                      ? "border-accent-2 bg-accent-2"
                      : "border-ink/25 bg-canvas"
                }`}
              />
              <div className="sm:mt-3">
                <p
                  className={`text-sm font-semibold ${current ? "text-accent" : done ? "text-ink" : "text-muted"}`}
                >
                  {stage.label}
                </p>
                <p className="text-muted mt-0.5 font-mono text-[11px]">
                  <time dateTime={stage.at} title={exact(stage.at)}>
                    {stage.detail ?? short(stage.at)}
                  </time>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
