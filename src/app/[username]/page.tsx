import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { getPublicProfile } from "@/server/repositories/profiles";

async function find(raw: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!decoded.startsWith("@")) return null;
  const handle = decoded.slice(1);
  if (!/^[A-Za-z0-9_]{3,30}$/.test(handle)) return null;
  return getPublicProfile(handle);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const profile = await find((await params).username);
  return profile
    ? {
        title: `${profile.displayName} (@${profile.username}) · Jam Session`,
        description: profile.bio ?? `Music profile for @${profile.username}.`,
      }
    : {};
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const profile = await find((await params).username);
  if (!profile) notFound();
  return (
    <main id="main-content">
      <Container className="py-20">
        <article className="mx-auto max-w-3xl">
          <div
            aria-hidden="true"
            className="bg-surface-raised border-strong flex size-24 items-center justify-center rounded-full border text-3xl font-bold"
          >
            {profile.displayName.slice(0, 1).toUpperCase()}
          </div>
          <h1 className="mt-6 text-4xl font-bold">{profile.displayName}</h1>
          <p className="text-accent mt-2 text-lg">@{profile.username}</p>
          <p className="text-muted mt-1">Music credits: {profile.creditName}</p>
          {profile.bio && (
            <p className="mt-8 max-w-prose text-lg leading-8 whitespace-pre-wrap">
              {profile.bio}
            </p>
          )}
          <section className="border-subtle mt-10 border-t pt-8">
            <h2 className="text-2xl font-bold">Accepted contributions</h2>
            <p className="text-muted mt-3">
              No public accepted contributions yet.
            </p>
          </section>
        </article>
      </Container>
    </main>
  );
}
