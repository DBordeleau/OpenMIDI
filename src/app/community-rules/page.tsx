import type { Metadata } from "next";
import { Container } from "@/components/layout/container";

export const metadata: Metadata = { title: "Community rules" };

export default function CommunityRulesPage() {
  return (
    <main id="main-content">
      <Container className="py-16">
        <article className="mx-auto max-w-3xl">
          <p className="text-accent-2 font-mono text-xs uppercase">
            Play fair. Keep the session safe.
          </p>
          <h1 className="mt-3 text-4xl font-bold">Community rules</h1>
          <p className="text-muted mt-4 text-lg">
            Jam Session is an invited music community. Bring work you have the
            right to share and treat collaborators like people.
          </p>
          <div className="mt-10 space-y-8">
            <section>
              <h2 className="text-2xl font-bold">Don’t publish</h2>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  illegal material or content that violates another person’s
                  rights;
                </li>
                <li>
                  non-consensual, private, or sexually exploitative material;
                </li>
                <li>targeted harassment, hateful abuse, or violent threats;</li>
                <li>
                  spam, deceptive links, malware, or attempts to misuse the
                  service.
                </li>
              </ul>
            </section>
            <section>
              <h2 className="text-2xl font-bold">Reporting and review</h2>
              <p className="mt-3">
                Reports are private and reviewed manually. Submitting one does
                not automatically hide content. Administrators may dismiss a
                report, hide or restore content, suspend an account, or preserve
                material under a legal or abuse hold. Public report counts are
                never shown.
              </p>
            </section>
            <section>
              <h2 className="text-2xl font-bold">Deletion and recovery</h2>
              <p className="mt-3">
                Project, eligible contribution, and account deletion hides
                content immediately and normally allows 30 days to recover it.
                Published credits, accepted contribution history, and fork
                lineage remain as unavailable tombstones when history depends on
                them.
              </p>
            </section>
            <section>
              <h2 className="text-2xl font-bold">Limits of the MVP</h2>
              <p className="mt-3">
                This prototype has no automated classifier, full appeals portal,
                emergency response service, or automated legal-compliance
                workflow. Formal copyright, takedown, appeal, and emergency
                contacts must be confirmed before invited release. If someone is
                in immediate danger, contact local emergency services.
              </p>
            </section>
          </div>
        </article>
      </Container>
    </main>
  );
}
