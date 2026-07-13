# Jam Session — Brand & Visual Design

Status: Adopted with the landing-page redesign (2026-07-13)

Audience: designers, engineers, and coding agents working on any user-facing
surface.

This document specifies the "warm studio night" visual identity introduced with
the marketing landing page. The design tokens live in
[`src/app/globals.css`](../../src/app/globals.css); this doc explains the intent
behind them so future styling sessions start with shared context.

---

## 1. Positioning & voice

Jam Session is a collaborative music platform. Our identity is built for
**musicians, producers, and artists** — not for engineers.

We are inspired by Git and open-source, and the underlying product genuinely is
versioned and fork-based. But that is **plumbing, not the pitch.** On
outward-facing surfaces we lead with the human outcome: making music with the
right people and getting credited for it.

**Say this**

- "Your song isn't done — it's waiting for the right people."
- "Build it together, in the browser."
- "Everyone who shaped it, named — for good."
- Warm, direct, artist-to-artist. Active voice. A control says what it does
  ("Create something", "Open the studio").

**Avoid this**

- "Git for music", "commits", "pull requests", "merge", "repositories" as the
  headline framing. These are fine in engineering docs, never in product copy.
- Cold, technical, or feature-list-first messaging that speaks to tooling rather
  than to the creative payoff.

The tone is confident and warm, like a good studio at 1am — not corporate SaaS.

---

## 2. Color

A committed **dark, warm palette**: a plum-black night lit by a coral→gold glow.
`color-scheme` is `dark`; there is no light theme (a deliberate single-world
choice that matches the app shell).

All colors are exposed as Tailwind tokens via `@theme inline`. **Always use the
token, never a raw hex**, so a future palette change stays a one-file edit.

| Token (CSS var)           | Hex                      | Tailwind utility                | Role                                                     |
| ------------------------- | ------------------------ | ------------------------------- | -------------------------------------------------------- |
| `--color-canvas`          | `#160f1a`                | `bg-canvas`                     | Page background (plum-black)                             |
| `--color-surface`         | `#1e1524`                | `bg-surface`                    | Base raised surface                                      |
| `--color-surface-raised`  | `#2a1d31`                | `bg-surface-raised`             | Cards, decks, sleeves                                    |
| `--color-surface-soft`    | `#140d19`                | `bg-surface-soft`               | Recessed insets, gradient bottoms                        |
| `--color-text`            | `#f7efe9`                | `text-ink`                      | Primary text (warm off-white)                            |
| `--color-text-muted`      | `#c6adb4`                | `text-muted`                    | Secondary text, captions, author names (warm mauve-grey) |
| `--color-border`          | `rgb(255 255 255 / 10%)` | `border-subtle`                 | Hairlines, dividers (light, airy)                        |
| `--color-border-strong`   | `rgb(255 255 255 / 16%)` | `border-strong`                 | Emphasized borders, ghost buttons                        |
| `--color-accent`          | `#ff8d63`                | `text-accent` / `bg-accent`     | **Primary accent — coral.** Kickers, primary marks       |
| `--color-accent-strong`   | `#ff7a4d`                | `bg-accent-strong`              | Coral hover state                                        |
| `--color-accent-2`        | `#ffc879`                | `text-accent-2` / `bg-accent-2` | **Secondary accent — gold.** Eyebrows, gradient end      |
| `--color-berry`           | `#e77aa6`                | `text-berry`                    | Tertiary accent — "new"/fork highlights, ambient glow    |
| `--color-accent-contrast` | `#2a1310`                | `text-accent-contrast`          | Dark foreground used **on** accent fills                 |
| `--color-danger`          | `#ff9c9c`                | `text-danger`                   | Errors                                                   |
| `--color-focus`           | `#ffcf8f`                | —                               | Focus-visible outline (warm gold)                        |

### Contrast rule (must hold)

Primary actions are a **light warm accent with a dark foreground**
(`--color-accent-contrast`, `#2a1310`). Never place white/light text on the coral
or gold accent — it fails WCAG AA. This mirrors the constraint in
[`docs/technical-design/01-system-architecture.md`](../technical-design/01-system-architecture.md).
`text-muted` on `bg-canvas` is our lightest body pairing and clears AA for body
text.

### Signature gradient

The brand's hero moment is the coral→gold gradient, reserved for **primary CTAs**
and accent numerals:

```css
linear-gradient(120deg, var(--color-accent), var(--color-accent-2))
```

Codified as the `.cta-gradient` utility in `globals.css`. The ambient page glow
(coral, gold, berry radial blobs) is rendered on canvas by
[`Aurora`](<../../src/app/(public)/_components/aurora.client.tsx>); the static body
gradient in `globals.css` provides the same warmth app-wide.

---

## 3. Typography

Three roles, each with a distinct job. Fonts are system stacks (no webfont CDN
dependency); personality comes from weight, size, tracking, and the serif accent.

| Role                | Family (token)                          | Usage                                                                                                                                                     |
| ------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Body / display**  | System sans (Segoe UI / SF / system-ui) | Headlines and body. Tight tracking on large display (`-0.035em`). Deliberately not a webfont — matches the approved mockup and avoids CDN/loading shifts. |
| **Accent**          | `font-serif` (Palatino → Georgia)       | Italic emphasis word inside a headline — the signature flourish.                                                                                          |
| **Utility / label** | `font-mono` (Consolas / SF Mono)        | Eyebrows, kickers, roles, metadata. Uppercase, wide tracking (`0.12–0.24em`).                                                                             |

**The serif-italic accent** is the identity's most recognizable move: one or two
words in a headline set in serif italic and colored coral (or gold in the lineage
timeline). Use it once per headline, never for whole headings.

```tsx
<h2>
  One project. Every take.{" "}
  <em className="text-accent font-serif font-medium">Everyone</em> in the mix.
</h2>
```

**Scale**: the hero uses **fluid** type — H1 `clamp(42px, 6.8vw, 92px)` at
`font-bold`, sub `clamp(16px, 1.7vw, 20px)` — so wrapping and size stay identical
across widths. Section H2 `text-3xl → sm:text-4xl → lg:text-5xl`; lede `text-lg`;
body `text-sm`/`text-base`; labels `text-[10.5px]–text-xs`. Give headings
`text-balance`; the hero H1 uses explicit `<br>` for its deliberate three-line
break. Keep running text near a 48–52ch measure.

**Label pattern** (eyebrow / kicker / role):

```tsx
<p className="text-accent font-mono text-[11px] tracking-[0.2em] uppercase">
  …
</p>
```

Gold (`text-accent-2`) for top-of-page eyebrows; coral (`text-accent`) for section
kickers. This distinction is meaningful — keep it consistent.

---

## 4. Motion

Motion should feel like a smooth fade-up into place, never busy or bouncy.

- **Scroll reveals** — the [`Reveal`](<../../src/app/(public)/_components/reveal.client.tsx>)
  component (built on `motion/react`) fades content up 22px on enter, `once`, with
  `cubic-bezier(0.2, 0.8, 0.2, 1)` over 0.6s. Stagger sibling groups by ~0.06s via
  the `delay` prop.
- **Ambient** — the aurora drifts slowly (multi-second periods) behind everything.
- **Hero waveform** — an animated multi-track waveform with a sweeping playhead is
  the hero's thesis; it shows the product _being_ collaborative rather than
  describing it.
- **Micro-interactions** — primary/secondary buttons lift `-translate-y-px` on
  hover with a softening shadow.

**Reduced motion is mandatory.** Every animated component checks
`prefers-reduced-motion`: `Reveal` renders content immediately, and the canvas
components (`Aurora`, `HeroWaveform`) draw a single static frame instead of
looping. `globals.css` also neutralizes transitions/animations under the media
query. Never ship motion without this fallback.

---

## 5. Components

Reusable patterns established by the landing page. Prefer these over re-inventing.

Shared application buttons and button links use the landing page's pill shape
(`rounded-full`). Variants may change fill, border, emphasis, or density, but must
not revert to the older `rounded-control` button silhouette. Form fields and
other compact controls continue to use `rounded-control`.

**Primary CTA** — pill, `.cta-gradient`, dark foreground, hover lift. On the
landing it is auth-aware (`AuthAwareLink`): signed-out → `/sign-in`, signed-in →
`/projects/new`, both labeled "Create something".

**Secondary CTA** — pill, `border-strong`, transparent fill, hover to gold border

- gold text.

**Floating CTA** — [`FloatingCta`](<../../src/app/(public)/_components/floating-cta.client.tsx>):
a persistent, blurred, bottom-right dock so the sign-up action follows the reader.
Collapses to a full-width bottom bar under 600px. Slides in ~700ms after load.

**Card** — `rounded-card`, `border-subtle`, `bg-surface-raised` (often a subtle
160° gradient toward `surface-soft`), deep soft shadow
(`shadow-[0_...px_-...px_#000]`).

**Console deck** — a mixer-style panel: track rows (`name · contributor`, mini
waveform, M/S chips). Chips light up coral (`M`) / gold (`S`) when active with a
dark foreground.

**Credits sleeve** — an album back-cover motif: inner hairline frame, serif title,
mono `role → name` rows on hairline dividers, a dashed "always attributed" stamp.
This is how we visualize attribution.

**Lineage timeline** — an ordered list of revisions: a narrow mono `Rev · author`
column (coral rev, muted author) beside a serif title (with gold italic accent) and
a **bright** (`text-ink/90`) change summary. Fork nodes indent with a berry
connector. The brightness split — muted author vs. bright summary — is intentional
hierarchy; preserve it.

**Labels** — see §3.

---

## 6. Layout & spacing

- **Container**: `max-w-[var(--content-width)]` (76rem) via
  [`Container`](../../src/components/layout/container.tsx), which now accepts an
  optional `id` for in-page section anchors.
- **Radius**: `--radius-control` (0.75rem) for inputs/compact controls,
  `--radius-card` (1.25rem) for cards, `rounded-full` for CTAs.
- **Section rhythm**: `py-20 sm:py-24` per section; hero uses more bottom room.
- **Anchors**: `[id]` carries `scroll-margin-top: 7rem` to clear the sticky header.

---

## 7. Accessibility

- Contrast rule in §2 is non-negotiable.
- Focus-visible: 2px `--color-focus` outline, 4px offset (global).
- Decorative canvases/graphics are `aria-hidden`; the hero `<h1>` carries the
  section's accessible name.
- Reduced-motion fallbacks per §4.
- Keyboard-operable at the 320px minimum layout.

---

## 8. Implementation map

| Concern                  | File                                                    |
| ------------------------ | ------------------------------------------------------- |
| Tokens, gradient, resets | `src/app/globals.css`                                   |
| Landing page             | `src/app/(public)/page.tsx`                             |
| Reveal animation         | `src/app/(public)/_components/reveal.client.tsx`        |
| Ambient aurora           | `src/app/(public)/_components/aurora.client.tsx`        |
| Hero waveform            | `src/app/(public)/_components/hero-waveform.client.tsx` |
| Floating CTA             | `src/app/(public)/_components/floating-cta.client.tsx`  |

---

## 9. Open follow-ups

- **Discovery surface**: hero/CTA copy points at collaboration and creating; a
  public `/explore` page (planned) would let "See how it works" / browse flows
  point at real songs instead of in-page anchors.
- **Self-hosted display face**: the serif accent currently relies on
  Palatino/Georgia system fallbacks. A self-hosted display face (inlined, no CDN)
  would sharpen the identity further.
