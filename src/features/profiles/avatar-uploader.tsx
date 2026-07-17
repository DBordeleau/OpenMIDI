"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { hasValidAvatarDimensions } from "./avatar-image";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

export function AvatarUploader({
  profileId,
  name,
  avatarUrl,
  avatarVersionId,
}: {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  avatarVersionId: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function upload(file: File) {
    if (
      !allowed.has(file.type) ||
      file.size < 1 ||
      file.size > 5 * 1024 * 1024
    ) {
      setMessage("Choose a JPEG, PNG, or WebP image no larger than 5 MiB.");
      return;
    }
    const dimensions = await readImageDimensions(file);
    if (!dimensions) {
      setMessage(
        "We couldn’t read that image. Choose another JPEG, PNG, or WebP file.",
      );
      return;
    }
    if (!hasValidAvatarDimensions(dimensions)) {
      setMessage(
        "Choose an image between 128 and 4,096 pixels on each side, with no more than 16.7 million total pixels.",
      );
      return;
    }
    setPending(true);
    setMessage("Uploading your private original…");
    const db = createSupabaseBrowserClient();
    const { data: reservation, error: reserveError } = await db.rpc(
      "reserve_profile_image_upload",
      {
        p_request_id: crypto.randomUUID(),
        p_expected_byte_size: file.size,
        p_filename: file.name,
        p_declared_media_type: file.type,
      },
    );
    const row = reservation?.[0];
    if (reserveError || !row) {
      setMessage("We couldn’t reserve this upload. Try again shortly.");
      setPending(false);
      return;
    }
    const { error: uploadError } = await db.storage
      .from(row.bucket)
      .upload(row.object_path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setMessage("The upload did not finish. Choose the file and try again.");
      setPending(false);
      return;
    }
    const { error: completeError } = await db.rpc(
      "complete_profile_image_upload",
      { p_asset_id: row.asset_id },
    );
    if (completeError) {
      setMessage("The upload finished, but processing could not start.");
      setPending(false);
      return;
    }
    const { error: invokeError } = await db.functions.invoke(
      "process-profile-image",
      { body: { assetId: row.asset_id } },
    );
    setMessage(
      invokeError
        ? "Your image is queued. Refresh later to check processing."
        : "Processing and sanitizing your avatar…",
    );
    if (!invokeError) {
      let installed = false;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        const { data } = await db
          .from("public_profiles")
          .select("avatar_version_id")
          .eq("id", profileId)
          .maybeSingle();
        if (data?.avatar_version_id === row.avatar_version_id) {
          installed = true;
          setMessage("Avatar updated.");
          router.refresh();
          break;
        }
      }
      if (!installed) {
        setMessage(
          "Processing did not finish. Try a still image between 128 and 4,096 pixels on each side.",
        );
      }
    }
    setPending(false);
  }

  async function remove() {
    if (!avatarVersionId) return;
    setPending(true);
    const db = createSupabaseBrowserClient();
    const { error } = await db.rpc("remove_own_avatar", {
      p_expected_avatar_version_id: avatarVersionId,
    });
    setMessage(
      error
        ? "The avatar changed elsewhere. Refresh and try again."
        : "Avatar removed. Cleanup is queued.",
    );
    if (!error) router.refresh();
    setPending(false);
  }

  return (
    <section
      className="border-subtle mt-8 border-b pb-8"
      aria-labelledby="avatar-heading"
    >
      <h2 id="avatar-heading" className="text-2xl font-semibold">
        Profile avatar
      </h2>
      <p className="text-muted mt-2">
        JPEG, PNG, or WebP up to 5 MiB. We center-crop it and publish only a
        sanitized square copy.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Avatar src={avatarUrl} name={name} size="md" />
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="cta-gradient text-accent-contrast min-h-11 rounded-full px-5 font-semibold disabled:opacity-60"
        >
          {pending
            ? "Working…"
            : avatarVersionId
              ? "Replace avatar"
              : "Upload avatar"}
        </button>
        {avatarVersionId && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void remove()}
            className="border-strong hover:border-accent hover:text-accent min-h-11 rounded-full border px-5 font-semibold transition-colors disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}

async function readImageDimensions(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch {
    return null;
  }
}
