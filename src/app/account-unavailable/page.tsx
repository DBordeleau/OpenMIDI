import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";

export default function AccountUnavailablePage() {
  return (
    <main id="main-content">
      <Container className="py-24">
        <section className="mx-auto max-w-xl" aria-labelledby="access-heading">
          <p className="text-danger font-mono text-xs tracking-[0.16em] uppercase">
            Access denied
          </p>
          <h1 id="access-heading" className="mt-3 text-3xl font-bold">
            Account unavailable
          </h1>
          <p className="text-muted my-4">
            Your profile may be paused, or this area may require administrator
            access. Contact the beta operator if you believe this is a mistake.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <form action={signOut}>
              <button className="cta-gradient text-accent-contrast min-h-11 w-full rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-px motion-reduce:transform-none motion-reduce:transition-none sm:w-auto">
                Sign out
              </button>
            </form>
            <ButtonLink href="/" variant="secondary">
              Return home
            </ButtonLink>
          </div>
        </section>
      </Container>
    </main>
  );
}
