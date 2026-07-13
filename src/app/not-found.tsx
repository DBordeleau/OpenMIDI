import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center">
      <Container>
        <p className="text-accent text-sm font-semibold">404</p>
        <h1 className="mt-3 text-4xl font-semibold">Page not found</h1>
        <p className="text-muted mt-4">
          The page you requested does not exist.
        </p>
        <div className="mt-8">
          <ButtonLink href="/">Return home</ButtonLink>
        </div>
      </Container>
    </main>
  );
}
