import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { FeedbackForm } from "@/features/feedback/feedback-form.client";
import { sanitizeFeedbackPathname } from "@/features/feedback/schema";
import { getApplicationVersion } from "@/features/feedback/server-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Send feedback" };

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireViewer("/feedback");
  const query = await searchParams;
  const sourcePathname = sanitizeFeedbackPathname(query.from);
  const applicationVersion = getApplicationVersion();

  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-accent-2 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
            OpenMIDI beta
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
            Help tune the next session
          </h1>
          <p className="text-muted mt-4 max-w-2xl text-lg">
            Share a bug or suggestion with the small administrator team. Your
            feedback stays private and separate from content reports.
          </p>
          <FeedbackForm
            sourcePathname={sourcePathname}
            applicationVersion={applicationVersion}
          />
        </div>
      </Container>
    </main>
  );
}
