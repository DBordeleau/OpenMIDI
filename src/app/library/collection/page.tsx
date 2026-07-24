import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal.client";
import { requireViewer } from "@/features/auth/guards";
import { ClipCollectionGrid } from "@/features/clip-collection/collection-grid.client";
import { ClipCollectionToolbar } from "@/features/clip-collection/collection-toolbar";
import {
  clipCollectionHref,
  parseClipCollectionSearch,
} from "@/features/clip-collection/search";
import { listOwnedPrivateMidiWorkspaces } from "@/server/repositories/midi-library";
import { listStudioClipCollection } from "@/server/repositories/studio-clip-collection";

type PageSearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  title: "Clip collection",
  description:
    "Your latest owned MIDI patterns and exact reusable versions you saved.",
};

export default async function ClipCollectionPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const parsed = parseClipCollectionSearch(await searchParams);
  const callback = clipCollectionHref(parsed.source, parsed.query);
  await requireViewer(callback);

  let error = parsed.error;
  let items: Awaited<ReturnType<typeof listStudioClipCollection>>["items"] = [];
  let workspaces: Awaited<ReturnType<typeof listOwnedPrivateMidiWorkspaces>> =
    [];

  if (!error) {
    try {
      const collectionRead = listStudioClipCollection({
        source: parsed.source,
        query: parsed.query,
        limit: 100,
      });
      if (parsed.source === "saved") {
        const [collection, ownedWorkspaces] = await Promise.all([
          collectionRead,
          listOwnedPrivateMidiWorkspaces(),
        ]);
        items = collection.items;
        workspaces = ownedWorkspaces;
      } else {
        items = (await collectionRead).items;
      }
    } catch {
      error = "Your clip collection is taking a moment to tune up. Try again.";
    }
  }

  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10">
        <Reveal>
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
                Your collection
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-balance sm:text-3xl">
                Patterns you made and exact versions you{" "}
                <em className="text-accent font-serif font-medium">kept</em>.
              </h1>
            </div>
            <ButtonLink
              href={parsed.source === "owned" ? "/studio" : "/library"}
              variant="secondary"
              prefetch={false}
            >
              {parsed.source === "owned" ? "Open Studio" : "Explore MIDI"}
            </ButtonLink>
          </header>
        </Reveal>

        <Reveal delay={0.05} className="mt-5">
          <ClipCollectionToolbar source={parsed.source} query={parsed.query} />
        </Reveal>

        {error ? (
          <MessageState
            title="That collection request needs another take."
            message={error}
            href={clipCollectionHref(parsed.source, null)}
            action="Reset collection"
          />
        ) : items.length ? (
          <section className="mt-6" aria-labelledby="collection-results">
            <Reveal delay={0.08} className="px-1">
              <h2 id="collection-results" className="text-muted text-sm">
                <span className="text-ink font-semibold">
                  {items.length} clip{items.length === 1 ? "" : "s"}
                </span>{" "}
                ·{" "}
                {parsed.source === "owned"
                  ? "one latest version per pattern you own"
                  : "exact versions you explicitly bookmarked"}
              </h2>
            </Reveal>
            <ClipCollectionGrid
              items={items}
              selectedSource={parsed.source}
              workspaces={workspaces}
            />
          </section>
        ) : parsed.query ? (
          <MessageState
            title={`No ${parsed.source === "owned" ? "owned" : "saved"} clips match that search.`}
            message="Try a title or creator with fewer words."
            href={clipCollectionHref(parsed.source, null)}
            action="Clear search"
          />
        ) : parsed.source === "owned" ? (
          <MessageState
            title="No clips made yet."
            message="Start in Studio and apply your first MIDI pattern."
            href="/studio"
            action="Open Studio"
          />
        ) : (
          <MessageState
            title="No saved clips yet."
            message="Bookmark a commercially reusable version from the MIDI Library."
            href="/library?rights=commercial_reuse"
            action="Explore reusable MIDI"
          />
        )}
      </Container>
    </main>
  );
}

function MessageState({
  title,
  message,
  href,
  action,
}: {
  title: string;
  message: string;
  href: string;
  action: string;
}) {
  return (
    <section className="rounded-card border-strong mt-7 border border-dashed p-8 text-center sm:p-10">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted mx-auto mt-2 max-w-xl">{message}</p>
      <div className="mt-5">
        <ButtonLink href={href} prefetch={false}>
          {action}
        </ButtonLink>
      </div>
    </section>
  );
}
