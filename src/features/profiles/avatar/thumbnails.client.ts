"use client";

import adventurerNeutralDefinition from "@dicebear/styles/adventurer-neutral.json";

export type AvatarPart = "eyebrows" | "eyes" | "glasses" | "mouth";

const ELEMENT_NAMES = new Set(["path", "ellipse"]);
const ATTRIBUTE_NAMES = new Set([
  "d",
  "fill",
  "cx",
  "cy",
  "rx",
  "ry",
  "fill-rule",
  "clip-rule",
]);

export function escapeAvatarThumbnailXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function serializeNode(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const node = value as Record<string, unknown>;
  if (node.type === "text" && typeof node.text === "string")
    return escapeAvatarThumbnailXml(node.text);
  if (
    node.type !== "element" ||
    typeof node.name !== "string" ||
    !ELEMENT_NAMES.has(node.name) ||
    !node.attributes ||
    typeof node.attributes !== "object"
  )
    return null;

  const attributes: string[] = [];
  for (const [name, rawValue] of Object.entries(
    node.attributes as Record<string, unknown>,
  )) {
    if (!ATTRIBUTE_NAMES.has(name) || typeof rawValue !== "string") return null;
    attributes.push(`${name}="${escapeAvatarThumbnailXml(rawValue)}"`);
  }
  const children = Array.isArray(node.elements)
    ? node.elements.map(serializeNode)
    : [];
  if (children.some((child) => child === null)) return null;
  return `<${node.name}${attributes.length ? ` ${attributes.join(" ")}` : ""}>${children.join("")}</${node.name}>`;
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function variantNumber(variant: string): number {
  const parsed = Number.parseInt(variant.replace(/^variant/, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fallbackDataUri(part: AvatarPart, variant: string): string {
  const number = variantNumber(variant);
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 72"><rect width="100" height="72" rx="12" fill="#2a1d31"/><text x="50" y="45" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#f7efe9">${escapeAvatarThumbnailXml(`${part.slice(0, 1).toUpperCase()}${number}`)}</text></svg>`,
  );
}

export function createAvatarThumbnailRenderer(definition: unknown) {
  const cache = new Map<string, string>();

  return {
    get(part: AvatarPart, variant: string): string {
      const key = `${part}:${variant}`;
      const cached = cache.get(key);
      if (cached) return cached;

      let result = fallbackDataUri(part, variant);
      if (definition && typeof definition === "object") {
        const components = (definition as Record<string, unknown>).components;
        if (components && typeof components === "object") {
          const component = (components as Record<string, unknown>)[part];
          if (component && typeof component === "object") {
            const record = component as Record<string, unknown>;
            const variants = record.variants;
            const width = record.width;
            const height = record.height;
            const selected =
              variants && typeof variants === "object"
                ? (variants as Record<string, unknown>)[variant]
                : null;
            const elements =
              selected && typeof selected === "object"
                ? (selected as Record<string, unknown>).elements
                : null;
            if (
              typeof width === "number" &&
              Number.isFinite(width) &&
              width > 0 &&
              typeof height === "number" &&
              Number.isFinite(height) &&
              height > 0 &&
              Array.isArray(elements)
            ) {
              const serialized = elements.map(serializeNode);
              if (serialized.length && serialized.every(Boolean))
                result = toDataUri(
                  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${serialized.join("")}</svg>`,
                );
            }
          }
        }
      }
      cache.set(key, result);
      return result;
    },
    cacheSize(): number {
      return cache.size;
    },
  };
}

const localThumbnailRenderer = createAvatarThumbnailRenderer(
  adventurerNeutralDefinition,
);

export function getAvatarPartThumbnailDataUri(
  part: AvatarPart,
  variant: string,
): string {
  return localThumbnailRenderer.get(part, variant);
}
