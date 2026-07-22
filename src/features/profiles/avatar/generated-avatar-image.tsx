import type { ReactNode } from "react";
import { avatarConfigFingerprint, type AvatarConfigV1 } from "./contract";
import { renderAvatarDataUri } from "./renderer";

export function GeneratedAvatarImage({
  config,
  className,
  pixels,
  alt,
  fallback,
}: {
  config: AvatarConfigV1;
  className: string;
  pixels: number;
  alt: string;
  fallback: ReactNode;
}) {
  let src: string;
  try {
    src = renderAvatarDataUri(config);
  } catch {
    return fallback;
  }

  // DiceBear renders a trusted local SVG data URI; no remote image request occurs.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`${className} object-cover`}
      src={src}
      width={pixels}
      height={pixels}
      alt={alt}
      data-avatar-fingerprint={avatarConfigFingerprint(config)}
    />
  );
}
