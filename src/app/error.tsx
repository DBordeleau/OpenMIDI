"use client";

import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <main className="flex min-h-screen items-center px-5">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-danger text-sm font-semibold">
          Something went wrong
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          We couldn’t load this page.
        </h1>
        <p className="text-muted mt-4">
          Try the request again, or return to the Jam Session home page.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Return home
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
