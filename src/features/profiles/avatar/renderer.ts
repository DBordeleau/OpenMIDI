import { Avatar, Style, type StyleDefinition } from "@dicebear/core";
import adventurerNeutralDefinition from "@dicebear/styles/adventurer-neutral.json";
import { parseAvatarConfig, type AvatarConfigV1 } from "./contract";

const adventurerNeutralStyle = new Style(
  adventurerNeutralDefinition as StyleDefinition,
);
const renderCache = new Map<string, string>();
const MAX_RENDER_CACHE_SIZE = 128;

export function renderAvatarDataUri(config: AvatarConfigV1): string {
  const cacheKey = JSON.stringify(config);
  const cached = renderCache.get(cacheKey);
  if (cached) return cached;
  const { options } = config;
  const dataUri = new Avatar(adventurerNeutralStyle, {
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
  if (renderCache.size >= MAX_RENDER_CACHE_SIZE) {
    const oldest = renderCache.keys().next().value;
    if (oldest) renderCache.delete(oldest);
  }
  renderCache.set(cacheKey, dataUri);
  return dataUri;
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
