import { Container } from "@/components/layout/container";
import {
  requireTestAuthConfig,
  signInTestActor,
} from "@/features/auth/test-auth";

export default function TestAuthPage() {
  requireTestAuthConfig();
  return (
    <main id="main-content">
      <Container className="py-24">
        <section className="mx-auto max-w-lg">
          <h1 className="text-3xl font-bold">Local test sign-in</h1>
          <p className="text-muted my-4">
            This development-only route signs in the deterministic browser-test
            actor.
          </p>
          <form action={signInTestActor}>
            <button className="rounded-control bg-accent text-accent-contrast min-h-11 px-5 font-semibold">
              Sign in test actor
            </button>
          </form>
        </section>
      </Container>
    </main>
  );
}
