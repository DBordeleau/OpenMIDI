import { Container } from "@/components/layout/container";
import { signOut } from "@/features/auth/actions";

export default function AccountUnavailablePage() {
  return (
    <main id="main-content">
      <Container className="py-24">
        <section className="mx-auto max-w-xl">
          <h1 className="text-3xl font-bold">Account unavailable</h1>
          <p className="text-muted my-4">
            This account cannot access Jam Session right now. Contact the
            operator if you believe this is a mistake.
          </p>
          <form action={signOut}>
            <button className="rounded-control bg-accent text-accent-contrast min-h-11 px-5 font-semibold">
              Sign out
            </button>
          </form>
        </section>
      </Container>
    </main>
  );
}
