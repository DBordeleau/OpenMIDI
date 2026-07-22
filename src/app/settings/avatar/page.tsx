import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { AvatarEditorShell } from "@/features/profiles/avatar/avatar-editor-shell.client";

export const metadata: Metadata = { title: "Customize avatar" };

export default async function AvatarSettingsPage() {
  const profile = await requireViewer("/settings/avatar");
  if (!profile.profileCompletedAt) redirect("/onboarding");
  const name = profile.displayName ?? profile.username ?? "OpenMIDI member";

  return (
    <main id="main-content">
      <Container className="min-w-0 py-6 sm:py-10">
        <header className="mb-8 max-w-2xl">
          <p className="text-accent-2 font-mono text-[11px] font-semibold tracking-[0.2em] uppercase">
            Account settings
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.02em]">
            Build your avatar
          </h1>
          <p className="text-muted mt-3 leading-7">
            Build a face for your OpenMIDI profile. Your choices are generated
            in this browser, with no photo upload required.
          </p>
        </header>
        <AvatarEditorShell
          profileId={profile.id}
          name={name}
          initialConfig={profile.avatarConfig}
          initialRevision={profile.avatarConfigRevision}
        />
        <p className="text-muted mt-8 text-xs leading-5">
          Avatar generated with DiceBear&apos;s Adventurer Neutral style.
          Artwork by Lisa Wischofsky, licensed under CC BY 4.0.
        </p>
      </Container>
    </main>
  );
}
