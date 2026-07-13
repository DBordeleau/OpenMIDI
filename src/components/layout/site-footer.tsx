import { Container } from "./container";

export function SiteFooter() {
  return (
    <footer className="border-subtle border-t py-8">
      <Container className="text-muted flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="text-ink font-semibold">Jam Session</span> —
          asynchronous music collaboration with history.
        </p>
        <p>Early MVP · © 2026</p>
      </Container>
    </footer>
  );
}
