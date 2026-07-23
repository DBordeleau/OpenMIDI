"use client";

import Link from "next/link";
import { FiEdit3 } from "react-icons/fi";
import { useViewer } from "@/components/layout/viewer-identity-provider.client";

export function viewerOwnsProfile(
  viewerUsername: string | null,
  profileUsername: string,
) {
  return (
    viewerUsername !== null &&
    viewerUsername.localeCompare(profileUsername, undefined, {
      sensitivity: "accent",
    }) === 0
  );
}

export function ProfileOwnerAction({
  profileUsername,
}: {
  profileUsername: string;
}) {
  const viewer = useViewer();
  if (!viewer.signedIn || !viewerOwnsProfile(viewer.username, profileUsername))
    return null;

  return (
    <Link
      className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-transform hover:-translate-y-px"
      href="/settings/profile"
      prefetch={false}
    >
      <FiEdit3 aria-hidden="true" />
      Edit profile
    </Link>
  );
}
