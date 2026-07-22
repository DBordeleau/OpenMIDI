"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { GeneratedAvatarImage } from "./generated-avatar-image";
import {
  AVATAR_EYEBROW_VARIANTS,
  AVATAR_EYE_VARIANTS,
  AVATAR_GLASSES_VARIANTS,
  AVATAR_MOUTH_VARIANTS,
  AVATAR_TONE_PALETTE,
  avatarConfigFingerprint,
  normalizeAvatarColor,
  type AvatarConfigV1,
  type AvatarOptionsV1,
} from "./contract";
import { randomizeAvatarOptions } from "./randomize";
import {
  getAvatarPartThumbnailDataUri,
  type AvatarPart,
} from "./thumbnails.client";

const TONE_NAMES = [
  "Warm sand",
  "Peach",
  "Umber",
  "Chestnut",
  "Deep brown",
  "Night brown",
  "Lavender",
] as const;

const tileClass =
  "border-strong bg-surface relative min-h-11 min-w-11 cursor-pointer overflow-hidden rounded-control border transition-colors hover:border-accent-2 has-checked:border-accent has-checked:ring-2 has-checked:ring-accent/40 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[var(--color-focus)]";

function PartPicker<Variant extends string>({
  label,
  part,
  variants,
  selected,
  onSelect,
  includeNone = false,
}: {
  label: string;
  part: AvatarPart;
  variants: readonly Variant[];
  selected: Variant | null;
  onSelect: (variant: Variant | null) => void;
  includeNone?: boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-lg font-bold">{label}</legend>
      <div
        role="radiogroup"
        aria-label={label}
        className="mt-3 grid min-w-0 grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8"
      >
        {includeNone && (
          <label
            className={`${tileClass} text-muted px-1 text-xs font-semibold`}
          >
            <input
              type="radio"
              name={`avatar-${part}`}
              checked={selected === null}
              onChange={() => onSelect(null)}
              aria-label="No glasses"
              className="sr-only"
            />
            None
          </label>
        )}
        {variants.map((variant, index) => (
          <label className={tileClass} key={variant}>
            <input
              type="radio"
              name={`avatar-${part}`}
              checked={selected === variant}
              onChange={() => onSelect(variant)}
              aria-label={`${label} ${index + 1}`}
              className="sr-only"
            />
            {/* Trusted, bundled SVG part; the radio carries the accessible name. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getAvatarPartThumbnailDataUri(part, variant)}
              alt=""
              className="bg-ink/90 h-12 w-full object-contain p-1"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AvatarEditor({
  profileId,
  name,
  options,
  onChange,
  disabled = false,
  actions,
}: {
  profileId: string;
  name: string;
  options: AvatarOptionsV1;
  onChange: (options: AvatarOptionsV1) => void;
  disabled?: boolean;
  actions: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const config: AvatarConfigV1 = { version: 1, seed: profileId, options };
  const update = <Key extends keyof AvatarOptionsV1>(
    key: Key,
    value: AvatarOptionsV1[Key],
  ) => onChange({ ...options, [key]: value });
  const previewFallback = (
    <span className="text-5xl font-bold" aria-label={`${name}'s initials`}>
      {name.trim().slice(0, 1).toUpperCase() || "J"}
    </span>
  );

  return (
    <div
      inert={disabled ? true : undefined}
      aria-busy={disabled || undefined}
      className={disabled ? "pointer-events-none opacity-70" : undefined}
    >
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="order-2 min-w-0 space-y-8 lg:order-1">
          <button
            type="button"
            onClick={() => onChange(randomizeAvatarOptions())}
            className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold transition-colors"
          >
            Randomize
          </button>
          <PartPicker
            label="Eyebrows"
            part="eyebrows"
            variants={AVATAR_EYEBROW_VARIANTS}
            selected={options.eyebrowsVariant}
            onSelect={(variant) =>
              variant && update("eyebrowsVariant", variant)
            }
          />
          <PartPicker
            label="Eyes"
            part="eyes"
            variants={AVATAR_EYE_VARIANTS}
            selected={options.eyesVariant}
            onSelect={(variant) => variant && update("eyesVariant", variant)}
          />
          <PartPicker
            label="Glasses"
            part="glasses"
            variants={AVATAR_GLASSES_VARIANTS}
            selected={
              options.glassesProbability === 0 ? null : options.glassesVariant
            }
            includeNone
            onSelect={(variant) =>
              onChange({
                ...options,
                glassesVariant: variant ?? options.glassesVariant,
                glassesProbability: variant ? 100 : 0,
              })
            }
          />
          <PartPicker
            label="Mouth"
            part="mouth"
            variants={AVATAR_MOUTH_VARIANTS}
            selected={options.mouthVariant}
            onSelect={(variant) => variant && update("mouthVariant", variant)}
          />

          <fieldset>
            <legend className="text-lg font-bold">Tone</legend>
            <div
              role="radiogroup"
              aria-label="Curated tones"
              className="mt-3 flex flex-wrap gap-2"
            >
              {AVATAR_TONE_PALETTE.map((tone, index) => (
                <label
                  title={`${TONE_NAMES[index]} #${tone}`}
                  className={`${tileClass} size-11 rounded-full p-1`}
                  key={tone}
                >
                  <input
                    type="radio"
                    name="avatar-tone"
                    checked={options.backgroundColor === tone}
                    onChange={() => update("backgroundColor", tone)}
                    aria-label={`${TONE_NAMES[index]} #${tone}`}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="block size-full rounded-full border border-black/20"
                    style={{ backgroundColor: `#${tone}` }}
                  />
                </label>
              ))}
            </div>
            <label className="mt-4 flex max-w-xs items-center justify-between gap-4 font-semibold">
              Custom tone
              <input
                type="color"
                aria-label="Custom tone color"
                value={`#${options.backgroundColor}`}
                onChange={(event) => {
                  const normalized = normalizeAvatarColor(event.target.value);
                  if (/^[0-9a-f]{6}$/.test(normalized))
                    update("backgroundColor", normalized);
                }}
                className="border-strong bg-surface rounded-control h-11 w-16 border p-1"
              />
            </label>
            <p className="text-muted mt-1 font-mono text-xs">
              #{options.backgroundColor}
            </p>
          </fieldset>

          <label className="block max-w-xl font-semibold">
            <span className="flex justify-between gap-4">
              Scale <output>{options.scale.toFixed(2)}x</output>
            </span>
            <input
              type="range"
              min="0.8"
              max="1.6"
              step="0.05"
              value={options.scale}
              aria-label="Avatar scale"
              aria-valuetext={`${options.scale.toFixed(2)} times`}
              onChange={(event) => update("scale", Number(event.target.value))}
              className="accent-accent mt-3 min-h-11 w-full"
            />
          </label>
          <label className="block max-w-xl font-semibold">
            <span className="flex justify-between gap-4">
              Rotation <output>{options.rotate} degrees</output>
            </span>
            <input
              type="range"
              min="-20"
              max="20"
              step="1"
              value={options.rotate}
              aria-label="Avatar rotation"
              aria-valuetext={`${options.rotate} degrees`}
              onChange={(event) => update("rotate", Number(event.target.value))}
              className="accent-accent mt-3 min-h-11 w-full"
            />
          </label>
        </div>

        <aside className="bg-canvas/95 border-subtle lg:rounded-card sticky top-0 z-20 order-1 -mx-3 border-b px-3 py-3 backdrop-blur lg:top-24 lg:order-2 lg:mx-0 lg:border lg:p-5">
          <p className="text-accent-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase">
            Live preview
          </p>
          <motion.div
            animate={reduceMotion ? undefined : { opacity: [0.82, 1] }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="border-strong bg-surface-raised mx-auto mt-3 flex size-40 items-center justify-center overflow-hidden rounded-full border sm:size-52 lg:size-60"
            data-reduced-motion={reduceMotion ? "true" : "false"}
            data-avatar-fingerprint={avatarConfigFingerprint(config)}
          >
            <GeneratedAvatarImage
              config={config}
              className="size-full rounded-full"
              pixels={240}
              alt={`${name}'s avatar preview`}
              fallback={previewFallback}
            />
          </motion.div>
          <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
            {actions}
          </div>
        </aside>
      </div>
    </div>
  );
}
