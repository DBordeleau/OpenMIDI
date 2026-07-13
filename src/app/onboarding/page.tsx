import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { ProfileForm } from "@/features/profiles/profile-form";

export default async function OnboardingPage() {
  const profile = await requireViewer("/onboarding");
  if (profile.profileCompletedAt) redirect("/settings/profile");
  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="mx-auto max-w-2xl">
          <p className="text-accent font-semibold">One last step</p>
          <h1 className="mt-2 text-4xl font-bold">
            Create your public profile
          </h1>
          <p className="text-muted mt-3">
            Choose your identity deliberately. Google profile details are never
            copied into your public profile.
          </p>
          <ProfileForm profile={profile} />
        </section>
      </Container>
    </main>
  );
}
