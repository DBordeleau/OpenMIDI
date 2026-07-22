import { Avatar, Style, type StyleDefinition } from "@dicebear/core";
import adventurerNeutralDefinition from "@dicebear/styles/adventurer-neutral.json";
import { parseAvatarConfig, type AvatarConfigV1 } from "./contract";

const adventurerNeutralStyle = new Style(
  adventurerNeutralDefinition as StyleDefinition,
);

export function renderAvatarDataUri(config: AvatarConfigV1): string {
  const { options } = config;
  return new Avatar(adventurerNeutralStyle, {
    seed: config.seed,
    backgroundColor: options.backgroundColor,
    borderRadius: 50,
    eyebrowsProbability: 100,
    eyebrowsVariant: options.eyebrowsVariant,
    eyesProbability: 100,
    eyesVariant: options.eyesVariant,
    glassesProbability: options.glassesProbability,
    glassesVariant: options.glassesVariant,
    mouthProbability: 100,
    mouthVariant: options.mouthVariant,
    scale: options.scale,
    rotate: options.rotate,
  }).toDataUri();
}

export function renderAvatarDataUriFromUnknown(value: unknown): string | null {
  const config = parseAvatarConfig(value);
  if (!config) return null;
  try {
    return renderAvatarDataUri(config);
  } catch {
    return null;
  }
}
