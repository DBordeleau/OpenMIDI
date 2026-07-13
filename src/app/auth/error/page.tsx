import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

export default function AuthErrorPage() {
  return (
    <main id="main-content">
      <Container className="py-24">
        <div className="mx-auto max-w-xl">
          <p className="text-danger font-semibold">Sign-in wasn’t completed</p>
          <h1 className="mt-2 text-3xl font-bold">Please try again</h1>
          <p className="text-muted my-5">
            Your invitation may be missing, the provider flow may have been
            cancelled, or the sign-in link may have expired.
          </p>
          <ButtonLink href="/sign-in">Return to sign in</ButtonLink>
        </div>
      </Container>
    </main>
  );
}
