"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  resetAvatarAction,
  saveAvatarAction,
  type AvatarActionResult,
} from "../actions";
import {
  DEFAULT_AVATAR_OPTIONS,
  type AvatarConfigV1,
  type AvatarOptionsV1,
} from "./contract";
import { AvatarConfirmationDialog } from "./avatar-confirmation-dialog.client";
import { AvatarEditor } from "./avatar-editor.client";

const secondaryButton =
  "border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-50";

export function AvatarEditorShell({
  profileId,
  name,
  initialConfig,
  initialRevision,
}: {
  profileId: string;
  name: string;
  initialConfig: AvatarConfigV1 | null;
  initialRevision: number;
}) {
  const router = useRouter();
  const initialOptions = initialConfig?.options ?? DEFAULT_AVATAR_OPTIONS;
  const [options, setOptions] = useState<AvatarOptionsV1>(initialOptions);
  const [savedOptions, setSavedOptions] =
    useState<AvatarOptionsV1>(initialOptions);
  const [revision, setRevision] = useState(initialRevision);
  const [configured, setConfigured] = useState(Boolean(initialConfig));
  const [result, setResult] = useState<AvatarActionResult | null>(null);
  const [confirmation, setConfirmation] = useState<"discard" | "reset" | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const dirty = useMemo(
    () => JSON.stringify(options) !== JSON.stringify(savedOptions),
    [options, savedOptions],
  );

  function leaveEditor() {
    if (dirty) {
      setConfirmation("discard");
      return;
    }
    router.push("/settings/profile");
  }

  function save() {
    setResult(null);
    startTransition(async () => {
      const next = await saveAvatarAction({
        expectedRevision: revision,
        options,
      });
      setResult(next);
      if (!next.ok) return;
      if (!next.avatarConfig) {
        setResult({
          ok: false,
          kind: "unavailable",
          message: "The saved avatar response was incomplete. Please refresh.",
        });
        return;
      }
      setOptions(next.avatarConfig.options);
      setSavedOptions(next.avatarConfig.options);
      setRevision(next.avatarConfigRevision);
      setConfigured(true);
      router.push("/settings/profile?avatar=saved");
      router.refresh();
    });
  }

  function reset() {
    setConfirmation(null);
    setResult(null);
    startTransition(async () => {
      const next = await resetAvatarAction({ expectedRevision: revision });
      setResult(next);
      if (!next.ok) return;
      setOptions(DEFAULT_AVATAR_OPTIONS);
      setSavedOptions(DEFAULT_AVATAR_OPTIONS);
      setRevision(next.avatarConfigRevision);
      setConfigured(false);
      router.push("/settings/profile?avatar=reset");
      router.refresh();
    });
  }

  const actions = (
    <>
      <button
        type="button"
        disabled={pending || (configured && !dirty)}
        onClick={save}
        className="cta-gradient inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={leaveEditor}
        className={secondaryButton}
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={pending || (!configured && !dirty)}
        onClick={() => setConfirmation("reset")}
        className={`${secondaryButton} hover:border-danger hover:text-danger`}
      >
        Reset to initials
      </button>
    </>
  );

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={leaveEditor}
          className="text-muted hover:text-accent inline-flex min-h-11 items-center text-sm font-semibold underline"
        >
          Back to profile
        </button>
        {dirty && <span className="text-muted text-xs">Unsaved changes</span>}
      </div>
      {result && !result.ok && (
        <p
          role="alert"
          className="text-danger rounded-control border border-current p-3 text-sm"
        >
          {result.message}
        </p>
      )}
      <AvatarEditor
        profileId={profileId}
        name={name}
        options={options}
        onChange={(next) => {
          setOptions(next);
          setResult(null);
        }}
        disabled={pending}
        actions={actions}
      />
      {confirmation && (
        <AvatarConfirmationDialog
          title={
            confirmation === "discard"
              ? "Discard your changes?"
              : "Reset to initials?"
          }
          body={
            confirmation === "discard"
              ? "Your unsaved avatar choices will be lost."
              : "Your generated avatar will be removed everywhere and your initials will return."
          }
          confirmLabel={
            confirmation === "discard" ? "Discard changes" : "Reset avatar"
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            if (confirmation === "discard") {
              setConfirmation(null);
              router.push("/settings/profile");
            } else {
              reset();
            }
          }}
        />
      )}
    </>
  );
}
