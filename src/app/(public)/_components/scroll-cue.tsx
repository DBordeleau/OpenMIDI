import styles from "./landing.module.css";

/**
 * A bobbing "scroll on" affordance pinned to the bottom of a full-height
 * section. It's a plain anchor to the next section id, so it rides the landing
 * container's smooth-scroll for free and needs no JavaScript.
 */
export function ScrollCue({
  href,
  label = "Scroll",
}: {
  href: string;
  label?: string;
}) {
  return (
    <a
      className={styles.scrollCue}
      href={href}
      aria-label="Scroll to next section"
    >
      <span>{label}</span>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
