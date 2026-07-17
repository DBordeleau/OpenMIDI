# Jam Session — Brand & Visual Design

Status: Adopted 2026-07-13 with the landing redesign; extended across the app
(header, sign-in, dashboard, projects, profile, studio) 2026-07-14; product
positioning updated for the MIDI-only pivot 2026-07-16.

Audience: designers, engineers, and coding agents working on any user-facing
surface.

This document specifies the "warm studio night" visual identity introduced with
the marketing landing page and now applied across the whole product. The design
tokens live in [`src/app/globals.css`](../../src/app/globals.css); this doc
explains the intent behind them so future styling sessions start with shared
context.

---

## 1. Positioning & voice

Jam Session is a playful public MIDI workshop. Our identity is built for
**bedroom producers, casual musicians, and learners** — not for engineers.

We are inspired by Git and open-source, and the underlying product genuinely is
versioned and fork-based. But that is **plumbing, not the pitch.** On
outward-facing surfaces we lead with the human outcome: making an idea quickly,
remixing what inspires you, trying a creative constraint, and receiving durable
credit when others build on your work.

**Say this**

- "Start with a pattern. Take it somewhere new."
- "Make a beat in the browser."
- "Remix it, trace it, credit it."
- "Try today's constraint."
- Warm, direct, artist-to-artist. Active voice. A control says what it does
  ("Create something", "Open the studio").

**Avoid this**

- "Git for music", "commits", "pull requests", "merge", "repositories" as the
  headline framing. These are fine in engineering docs, never in product copy.
- Promises of uploaded stems, recording audio, or professional DAW replacement.
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
[`Aurora`](../../src/components/layout/aurora.client.tsx), mounted **once in the
root layout** so every page shares it; a fixed body gradient in `globals.css`
backs it up. See §5 (Ambient background).

### Cascade layers (do not override utilities)

Tailwind v4 (`@import "tailwindcss"`) puts every utility in the `utilities`
cascade layer, and **unlayered CSS beats layered CSS regardless of specificity.**
A bare element rule in `globals.css` — e.g. `a { color: inherit }` — therefore
silently overrides `text-*` / `hover:text-*` on that element _everywhere_ (this
broke every nav hover until it was found). Keep `globals.css` custom rules to
genuinely global concerns (tokens, `body`, focus, `::selection`), and never add an
unlayered element rule that sets a property utilities are expected to control.
Preflight already resets `a`, `button`, etc. in its base layer.

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

- **Scroll reveals** — the [`Reveal`](../../src/components/ui/reveal.client.tsx)
  component (built on `motion/react`) fades content up 22px on enter, `once`, with
  `cubic-bezier(0.2, 0.8, 0.2, 1)` over 0.6s. Stagger sibling groups by ~0.06s via
  the `delay` prop.
- **Ambient** — the aurora drifts slowly (multi-second periods) behind everything.
- **Hero MIDI grid** — the compact multi-track step arrangement is the hero's
  thesis; it shows the product _being_ collaborative rather than describing it.
- **Micro-interactions** — primary/secondary buttons lift `-translate-y-px` on
  hover with a softening shadow.
- **Page transitions** — every route fades in via
  [`src/app/template.tsx`](../../src/app/template.tsx) so navigations feel smooth,
  not stiff. It animates **opacity only** on purpose: a `transform` on this
  wrapper would reparent `position: fixed` overlays (sign-in modal, aurora,
  floating CTA) and break them. For richer per-section entrances, wrap content in
  `Reveal` (see the landing).

**Reduced motion is mandatory.** Every animated component checks
`prefers-reduced-motion`: `Reveal` renders content immediately and `Aurora` draws a
single static frame instead of looping. The hero MIDI grid is already static.
`globals.css` also neutralizes transitions/animations under the media query. Never
ship motion without this fallback.

---

## 5. Components

Reusable patterns established by the landing page. Prefer these over re-inventing.

Shared application buttons and button links use the landing page's pill shape
(`rounded-full`). Variants may change fill, border, emphasis, or density, but must
not revert to the older `rounded-control` button silhouette. Form fields and
other compact controls continue to use `rounded-control`.

**Icons & symbols** — use [`react-icons`](https://react-icons.github.io/react-icons/)
for any glyph or symbol (transport controls, zoom, reorder, delete, close, chevrons,
etc.). The house set is **Feather** (`react-icons/fi`) for its clean, uniform stroke;
reach for another set only when Feather lacks the mark. **Never use emoji as UI
symbols** — they render inconsistently across platforms and clash with the type. A
short typographic arrow (`→`) inside link text is fine; a glyph that acts as a
_control_ (a close button, a toolbar action) must be a react-icon. Icons scale to
`1em`, so size them with `text-*` on the button; give every icon-only button an
`aria-label` and a `title`, and text buttons with a leading icon add `gap-2`.

**Primary CTA** — pill, `.cta-gradient`, dark foreground, hover lift. On the
landing it is auth-aware (`AuthAwareLink`): signed-out → `/sign-in`, signed-in →
`/projects/new`, both labeled "Create something".

**Secondary CTA** — pill, `border-strong`, transparent fill, hover to accent border
and accent text.

**Floating CTA** — `FloatingCta` in `src/app/(public)/_components/floating-cta.client.tsx`:
a persistent, blurred, bottom-right dock so the sign-up action follows the reader.
Collapses to a full-width bottom bar under 600px. Slides in ~700ms after load.

**Card** — `rounded-card`, `border-subtle`, `bg-surface-raised` (often a subtle
160° gradient toward `surface-soft`), deep soft shadow
(`shadow-[0_...px_-...px_#000]`).

**Console deck** — a mixer-style panel: track rows (`name · contributor`, compact
note-timing summary, M/S chips). Chips light up coral (`M`) / gold (`S`) when active
with a dark foreground.

**Credits sleeve** — an album back-cover motif: inner hairline frame, serif title,
mono `role → name` rows on hairline dividers, a dashed "always attributed" stamp.
This is how we visualize attribution.

**Lineage timeline** — an ordered list of revisions: a narrow mono `Rev · author`
column (coral rev, muted author) beside a serif title (with gold italic accent) and
a **bright** (`text-ink/90`) change summary. Fork nodes indent with a berry
connector. The brightness split — muted author vs. bright summary — is intentional
hierarchy; preserve it.

**Header** — the logo is soft sans-bold with a coral→gold gradient dot; the logo
and nav links hover to `text-accent`. The header is auth-aware
([`HeaderNav`](../../src/components/layout/header-nav.client.tsx)): signed-out
visitors get marketing section links (`/#how`, `/#console`, `/#credits`) that
smooth-scroll the landing plus a single "Sign in" pill; signed-in members get the
app workspace nav and an "Account" action. Never show the app nav to signed-out
visitors.

**Sign-in modal** — [`SignInModal`](../../src/app/sign-in/_components/sign-in-modal.client.tsx)
presents sign-in as a focused modal over a blurred backdrop: a warm scale/fade
entrance and a fade-out on close (Escape, backdrop, or the icon button) that routes
home. The Google button is a white pill with the 4-colour Google mark.

**Studio surface** — manifest-v3 sessions use the browser-only
[`MidiStudioSurface`](../../src/features/studio/midi-adapter/midi-studio-surface.client.tsx)
with the shared
[`ArrangerWorkspace`](../../src/features/studio/arranger/arranger-workspace.tsx):
gold MIDI note summaries sit in dark plum lanes with fixed compact channel strips,
exact-value inspection, and react-icon transport/zoom/follow actions.
The studio is a deliberate **full-bleed exception** to the 76rem `Container` in §6:
`/studio` routes render edge-to-edge with tight gutters, drop the marketing footer
(via [`ConditionalFooter`](../../src/components/layout/conditional-footer.client.tsx)),
and the arranger fills the viewport height so the timeline behaves like desktop DAW
software rather than a centered web page. Channel strips are `17rem`; the inspector
column is `20rem`. When widening the channel column, keep `CHANNEL_PX` in
`arranger-workspace.tsx` in lockstep — the playhead and timeline are positioned in
pixels against that CSS width.
The project-independent `/studio` state uses the same lane, ruler, inspector, and
status vocabulary as a visibly blank workstation; project lifecycle actions live in
a compact File menu and never imply that the blank arrangement is persisted.
Editable sessions keep the next Add a track row pinned beneath the channels. Its
pending MIDI lane uses the established dashed/accent state, pill actions, centered
timeline copy, and semantic focus treatment; it is visibly provisional until a clip
materializes it.
The shared MIDI editor piano uses full white faces, shorter gradient black faces,
warm semantic dividers, and accent/gold held-note feedback. Melodic gutters label
only C rows while drum presets retain their mapped names; performance keys expose
the same held state with shape, contrast-safe colour, glow, and reduced-motion-safe
press feedback, and a held pointer may glide across them as one continuous gesture.
Its pill-shaped Pencil/Select tool group uses visible pressed state;
Select renders a translucent semantic-gold marquee while the synchronized note list
and inspector retain exact, keyboard-accessible selection controls.
Keep MIDI lanes short so more tracks fit without scrolling, and use note timing,
pitch range, density, clip length, loop state, and preset colour rather than a fake
audio waveform.

**Cursors & hover feedback** — interactive controls must feel interactive.
`globals.css` gives `button`/`summary`/`select`/checkbox/radio/range/`[role=button]`
and checkbox/radio labels `cursor: pointer` via a base-layer rule (so `cursor-*`
utilities still win). Beyond the cursor, give controls a visible hover: buttons use
the pill hover states above; bordered/selectable rows (filter chips, checkbox cards)
`hover:border-accent-2 transition-colors`; inputs `focus:border-accent`.

**Ambient background** — two layers, both app-wide, so no page reads as flat "dark
mode". (1) The animated [`Aurora`](../../src/components/layout/aurora.client.tsx)
canvas is mounted **once in the root layout** at `z-0`, with all content lifted into
a `relative z-10` wrapper above it — this is the visible warmth and it drifts as you
navigate. (2) A fixed `body` gradient (`background-attachment: fixed`) in
`globals.css` backs it up. When adding a new full-bleed fixed layer, remember the
layout's `z-10` content wrapper — negative/zero z-index behind it, not in front.

**Musical keys** — never render raw slugs (`f-sharp-minor`) or naive text
("f sharp minor"). Use
[`formatMusicalKey`](../../src/features/projects/musical-key.ts) for readable output
with real accidentals ("F♯ minor", "E♭ major") or `formatMusicalKeyShort` for
compact badges ("F♯m"). Applies everywhere a key appears — cards, filters, project
pages, the create/edit form.

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

| Concern                   | File                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| Tokens, gradient, resets  | `src/app/globals.css`                                                     |
| Shared buttons            | `src/components/ui/button.tsx`                                            |
| Landing page              | `src/app/(public)/page.tsx`                                               |
| Reveal (entrance anim)    | `src/components/ui/reveal.client.tsx`                                     |
| Ambient aurora (app-wide) | `src/components/layout/aurora.client.tsx` (mounted in root layout)        |
| Hero MIDI grid            | `src/app/(public)/_components/hero-midi-grid.tsx`                         |
| Floating CTA              | `src/app/(public)/_components/floating-cta.client.tsx`                    |
| Header / nav              | `src/components/layout/header-nav.client.tsx`                             |
| Sign-in modal             | `src/app/sign-in/_components/sign-in-modal.client.tsx`                    |
| MIDI Studio surface       | `src/features/studio/midi-adapter/midi-studio-surface.client.tsx`         |
| Unified arranger          | `src/features/studio/arranger/arranger-workspace.tsx`                     |
| Integrated MIDI composer  | `src/features/studio/integrated-midi/integrated-midi-composer.client.tsx` |
| Shared MIDI piano         | `src/features/midi/stems/stem-editor.client.tsx` and `piano-roll.ts`      |
| Icons                     | `react-icons` (Feather set, `react-icons/fi`)                             |
| Page-transition wrapper   | `src/app/template.tsx`                                                    |
| Musical key formatting    | `src/features/projects/musical-key.ts`                                    |

---

## 9. Open follow-ups

- **Discovery surface**: hero/CTA copy points at collaboration and creating; a
  public `/explore` page (planned) would let "See how it works" / browse flows
  point at real songs instead of in-page anchors.
- **Self-hosted display face**: the serif accent currently relies on
  Palatino/Georgia system fallbacks. A self-hosted display face (inlined, no CDN)
  would sharpen the identity further.
