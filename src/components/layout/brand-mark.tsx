/**
 * The OpenMIDI mark: three offset MIDI bars in the coral→gold brand gradient.
 * Shared so the landing nav and the shared application header render the exact
 * same logo (docs/design/brand.md §5). SVG gradient stops are set through
 * `style` rather than the `stop-color` attribute because CSS custom properties
 * do not resolve inside presentation attributes.
 */
export function BrandMark({
  size = 22,
  gradientId = "openmidi-mark",
}: {
  size?: number;
  /** Must be unique per rendered instance on a page. */
  gradientId?: string;
}) {
  const fill = `url(#${gradientId})`;
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-accent)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-accent-2)" }} />
        </linearGradient>
      </defs>
      <rect x="0" y="2" width="13" height="4" rx="1.6" fill={fill} />
      <rect
        x="4"
        y="9"
        width="18"
        height="4"
        rx="1.6"
        fill={fill}
        opacity="0.78"
      />
      <rect
        x="2"
        y="16"
        width="9"
        height="4"
        rx="1.6"
        fill={fill}
        opacity="0.5"
      />
    </svg>
  );
}
