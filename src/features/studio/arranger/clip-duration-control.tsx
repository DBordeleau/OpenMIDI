"use client";

import { FiMinus, FiPlus, FiRepeat } from "react-icons/fi";
import type { MusicalTimeSignature } from "./musical-time";
import {
  barsToTicks,
  formatBarsInput,
  formatMusicalDuration,
  getBeatTicks,
} from "./musical-time";

const iconButton =
  "border-strong text-muted hover:border-accent hover:text-accent grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-40";
const field =
  "border-strong bg-canvas rounded-control min-h-10 w-full border px-3 text-sm tabular-nums disabled:opacity-60";

type ClipDurationControlProps = {
  clip: {
    durationTicks: number;
    sourceStartTick: number | null;
    sourceDurationTicks: number | null;
    loop: boolean;
  };
  signature: MusicalTimeSignature;
  editable: boolean;
  onPatch: (patch: Record<string, number | boolean>, group: string) => void;
};

export function ClipDurationControl({
  clip,
  signature,
  editable,
  onPatch,
}: ClipDurationControlProps) {
  const beatTicks = getBeatTicks(signature);
  const sourceSpan =
    clip.sourceDurationTicks === null
      ? null
      : Math.max(1, clip.sourceDurationTicks - (clip.sourceStartTick ?? 0));
  const repeats =
    sourceSpan === null ? null : Math.max(1, clip.durationTicks / sourceSpan);

  function setLength(durationTicks: number) {
    const bounded = Math.max(1, Math.round(durationTicks));
    onPatch(
      sourceSpan !== null && bounded > sourceSpan
        ? { durationTicks: bounded, loop: true }
        : { durationTicks: bounded },
      "duration",
    );
  }

  return (
    <fieldset className="border-subtle rounded-control space-y-3 border p-3">
      <legend className="text-muted px-1 font-mono text-[10px] tracking-widest uppercase">
        Clip length
      </legend>
      <div className="flex items-end gap-2">
        <button
          type="button"
          className={iconButton}
          aria-label="Shorten clip by one beat"
          title="Shorten by one beat"
          disabled={!editable || clip.durationTicks <= beatTicks}
          onClick={() => setLength(clip.durationTicks - beatTicks)}
        >
          <FiMinus aria-hidden />
        </button>
        <label className="min-w-0 flex-1 text-xs font-semibold">
          Length in bars
          <input
            className={`${field} mt-1`}
            type="number"
            min={1 / signature.numerator}
            step={1 / signature.numerator}
            disabled={!editable}
            value={formatBarsInput(clip.durationTicks, signature)}
            onChange={(event) => {
              const bars = Number(event.target.value);
              if (Number.isFinite(bars) && bars > 0)
                setLength(barsToTicks(bars, signature));
            }}
          />
        </label>
        <button
          type="button"
          className={iconButton}
          aria-label="Extend clip by one beat"
          title="Extend by one beat"
          disabled={!editable}
          onClick={() => setLength(clip.durationTicks + beatTicks)}
        >
          <FiPlus aria-hidden />
        </button>
      </div>
      <p className="text-muted text-[11px] leading-5">
        {formatMusicalDuration(clip.durationTicks, signature)}. The buttons
        adjust one beat at a time.
      </p>
      <label className="border-subtle hover:border-accent-2 flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 transition-colors">
        <input
          type="checkbox"
          checked={clip.loop}
          disabled={!editable}
          onChange={(event) => onPatch({ loop: event.target.checked }, "loop")}
        />
        <FiRepeat
          aria-hidden
          className={clip.loop ? "text-accent" : "text-muted"}
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">
            Repeat source to fill clip
          </span>
          <span className="text-muted block text-[11px] leading-4">
            {sourceSpan === null
              ? "The immutable source length is unavailable."
              : clip.loop && repeats !== null && repeats > 1
                ? `${formatMusicalDuration(sourceSpan, signature)} source · ${formatRepeatCount(repeats)}`
                : clip.loop
                  ? "Repeat is on. Extend the clip to add another pass."
                  : `${formatMusicalDuration(sourceSpan, signature)} source · one pass.`}
          </span>
        </span>
      </label>
      {sourceSpan !== null && !clip.loop && (
        <p className="text-muted text-[11px] leading-5">
          Extending past the source turns repeat on. Turning repeat off trims
          the clip back to one source pass.
        </p>
      )}
      {sourceSpan !== null && clip.loop && clip.durationTicks > sourceSpan && (
        <p className="text-muted text-[11px] leading-5">
          Turning repeat off will trim this clip to{" "}
          {formatMusicalDuration(sourceSpan, signature)}.
        </p>
      )}
    </fieldset>
  );
}

function formatRepeatCount(repeats: number) {
  const rounded = Number.isInteger(repeats)
    ? String(repeats)
    : repeats.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${rounded}× playback`;
}
