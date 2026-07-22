import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/features/auth/actions";
import { sanitizeNextPath } from "@/features/auth/redirect";
import { hasSupabasePublicEnvConfiguration } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/layout/brand-mark";
import { SignInModal } from "./_components/sign-in-modal.client";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 5.1 29.3 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 5.1 29.3 3 24 3 16.3 3 9.7 7.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.1 26.7 35 24 35c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 43 24 43z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 36.5 44 31 44 23c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = sanitizeNextPath((await searchParams).next, "/onboarding");
  if (hasSupabasePublicEnvConfiguration()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) redirect("/onboarding");
  }

  return (
    <main id="main-content">
      <SignInModal>
        {/* The wordmark anchors the modal when it is reached directly rather
            than from the landing. Everything else is type and space. */}
        {/* The wordmark is one flex item, not three: a bare "Open" text node
            beside the mark would become its own anonymous flex item and take
            the container's gap between the two halves of the name. */}
        <span className="text-ink inline-flex items-center gap-2.5 text-[15px] font-bold tracking-[-0.03em]">
          <BrandMark size={20} gradientId="sign-in-mark" />
          <span>
            Open<span className="text-muted font-medium">MIDI</span>
          </span>
        </span>

        <h1
          id="signin-title"
          className="mt-7 text-[1.75rem] leading-[1.12] font-bold tracking-[-0.03em] sm:text-3xl"
        >
          Open beta coming soon!
        </h1>
        <p className="text-muted mt-3.5 leading-relaxed">
          OpenMIDI is invite-only while we are in beta. Sign in with the Google
          account tied to your invitation.
        </p>

        <form action={signInWithGoogle} className="mt-8">
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-white px-5 font-semibold text-[#1f1f1f] shadow-sm transition duration-200 hover:-translate-y-px hover:bg-white/90"
          >
            <GoogleMark />
            Continue with Google
          </button>
        </form>

        <hr className="border-subtle mt-8 border-t" />
        <p className="text-muted mt-4 text-xs leading-relaxed">
          By continuing you agree to keep the community rules — only publish
          work you have the rights to share.
        </p>
      </SignInModal>
    </main>
  );
}
