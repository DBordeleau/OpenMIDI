# OpenMIDI — Brand & Visual Design

> OpenMIDI is the sole prelaunch product and technical identity. RELEASE-01 removed transitional copy and namespaces without creating a second visual system.

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

OpenMIDI is a playful public MIDI workshop. Our identity is built for
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

**Card** — `rounded-card`, `border-subtle`, `bg-surface-raised` (often a subtle
160° gradient toward `surface-soft`), deep soft shadow
(`shadow-[0_...px_-...px_#000]`).

**Dashboard launcher** — `/dashboard` is a launcher, not a report: it has **no
page heading** (the nav already says where you are) and every row carries the
action you came for. Its cards use `.dash-card` in `globals.css` — the nav
sheet's glass at card scale, with `.dash-card-lit` for the coral→gold top edge
and `.dash-card-action` for the hover lift. Reach for that class rather than
re-deriving the gradient in utilities; that is what keeps the surface from
drifting between pages.

Three rules the page depends on:

- **One action per row.** The row is a stretched link to the thing itself and
  the single button goes to the Studio or the editor. Four projects means four
  buttons, not eight. `View all` is a quiet text link so it stops competing.
- **Counts are state.** A zero drops the gradient and renders muted
  ([`StateRail`](../../src/features/dashboard/state-rail.tsx)) so "nothing to do"
  reads instantly instead of looking like a broken stat.
- **Previews are real or they are not previews.** The resume band draws clip
  positions from the workspace manifest, and each block deep-links to
  `/studio/{projectId}?editClip={clipId}`. Clip rows show length and note count
  rather than a piano roll, because the payload carries no note data — a drawn
  roll would be decoration pretending to be information.

**Dashboard on a phone** — the same page at higher density, roughly half the
scroll height. Every mobile change is a base utility with an `sm:` restore, so
the pointer layout is byte-identical; keep it that way when editing.

- The state rail is **two columns from the smallest screen** (`grid-cols-2 …
lg:grid-cols-4`). Left at one column it cost about half a screen for four
  numbers. Its "Open review queue →" row is `sr-only sm:not-sr-only` rather than
  `hidden` — it names the destination, so it must stay in the accessibility tree.
- Rows past the third are `hidden sm:flex` / `hidden sm:grid`
  (`MOBILE_ROWS` in `launcher-lists.tsx`). Desktop still shows five. On a phone
  rows four and five are never on screen with anything else, so hiding them lets
  a thumb reach the next _section_ instead of the next row.
- Row actions shorten to "Studio" / "Editor" below `sm` but carry an
  `aria-label` of the full "Open in studio" / "Open in editor". The accessible
  name contains the visible label, which is what WCAG 2.5.3 requires — do not
  invert this into an icon-only control.
- Clip cards fold to two lines by moving the length bar inline beside the action
  and the measurements up beside the name. The alternate pieces use
  `hidden`/`sm:hidden` rather than conditional rendering: `display: none`
  removes a node from the accessibility tree, so only the visible one is
  announced.

Explicitly rejected: tabs or a carousel over Projects/Clips (hides a section
behind a tap on a page whose whole job is one-press navigation) and icon-only
row actions (the label is what makes the row's second destination
discoverable).

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

**Landing scroll** — the landing is its own snapping scroll port with
`scroll-snap-type: y proximity`, driven by
[`SectionScroller`](<../../src/app/(public)/_components/section-scroller.client.tsx>)
so one wheel gesture glides to the next section. **On `pointer: coarse` that all
switches off**: the page hands scrolling back to the document and drops snapping,
because proximity snap resolves _after_ a thumb lifts, so a flick landing between
two sections gets yanked to whichever edge is nearer. A wheel gesture is discrete
enough for snapping to feel intentional; a swipe is not. The nested scroll port
also blocks the mobile URL bar from collapsing.

Two traps live in that rule, both load-bearing:

- The mobile override needs `overflow-x: clip`, not `hidden`. When one axis is
  `hidden` the other computes back to `auto`, which would silently leave the
  element a scroll container and undo the whole thing.
- `SectionScroller` bails unless the container's computed `overflow-y` is
  `auto`/`scroll`. Without that it would drive `scrollTop` on a non-scrolling
  element and read every wheel event as section 0.

`tests/e2e/landing-mobile.spec.ts` pins the touch half and `home.spec.ts` pins
the pointer half — change one and the other should fail loudly.

**Landing gutters** — `.heroIn` carries both `.wrap` and its own `padding`
shorthand, and the shorthand zeroes the wrap's inline padding. The 76rem
container hides that on a wide screen; on a phone it put the headline and CTAs
hard against the glass. The gutter is restored in the `max-width: 59.99rem`
block only. Watch for this whenever a `.wrap` element also sets `padding`.

**Header** — the shared header and the landing nav are one design. Both use the
[`BrandMark`](../../src/components/layout/brand-mark.tsx) three-bar logo beside
the `Open` + muted `MIDI` wordmark, quiet `text-[13px]` semibold links in
`text-muted` that hover to `text-accent`, and a single pill-or-avatar action on
the right. Do not let the two drift apart again: a visitor should not be able to
tell that signing in swapped the component.

The header is auth-aware
([`HeaderNav`](../../src/components/layout/header-nav.client.tsx)). Signed-out
visitors get marketing section links (The MIDI Library, Versioning, Challenges)
plus a ghost "Sign in" pill. Signed-in members get exactly **four** top-level
items — Dashboard, Explore, Studio, and the avatar — because a flat list of every
destination read as clutter. Discovery groups under **Explore** (MIDI Library,
Projects, Challenges) and everything account-shaped groups under the **avatar**
(View profile, My projects, Saved clips, Contributions, Edit profile, Sign out).
View profile appears only after the verified browser identity resolves a
completed public username; onboarding and unavailable-profile states never
receive a broken public link. Never show the app nav to signed-out visitors, and
keep new destinations inside an existing group rather than adding a fifth
top-level item.

**Mobile navigation** — below `sm` the header steps back to identity and one
action (56px instead of 72px), and
[`MobileTabBar`](../../src/components/layout/mobile-tab-bar.client.tsx) carries
navigation from the thumb zone: four fixed tabs matching the desktop IA, with
Explore and Account raising a bottom sheet in the `.nav-glass` treatment. The
sheet is anchored immediately above the persistent tab bar and slides out from
behind its top edge; it must never cover the controls that opened it. Its visual
handle is a real touch target: tapping closes the sheet, a deliberate downward
drag dismisses it, and a short drag snaps it back without scrolling the page or
triggering pull-to-refresh. Signed-out visitors get no tabs — a nav they cannot
use is worse than none — so
[`ConditionalMobileNav`](../../src/components/layout/conditional-mobile-nav.client.tsx)
gives them a single "Join the beta" dock instead, and hides both on the landing,
sign-in, onboarding and the Studio.

Three rules hold this together:

- **One IA, two renderers.** The link list and every active-route predicate live
  in [`nav-items.ts`](../../src/components/layout/nav-items.ts). Add a
  destination there, never to one bar. The desktop nav and the tab bar are
  presentations, not separate navigations.
- **One identity read.** [`ViewerIdentityProvider`](../../src/components/layout/viewer-identity-provider.client.tsx)
  resolves the viewer once above both bars; a bar calling the hook itself would
  double the claim check and profile read on every navigation.
- **Reserve the home indicator.** Fixed bottom chrome uses the `pb-safe`
  utility (`env(safe-area-inset-bottom)`), and full-height surfaces use `dvh`,
  not `vh` — mobile browser chrome expands and collapses under the bar.

The tab bar slides down on the way into the Studio exactly as the header slides
up, and reads its route through the same frozen-pathname provider.

**Nav dropdown** — [`NavMenu`](../../src/components/layout/nav-menu.client.tsx)
is the shared panel for both groups: a disclosure (button + `aria-expanded`,
_not_ ARIA menu roles, so Tab order stays predictable over ordinary links) that
closes on Escape, outside pointerdown, focus-out, and any completed navigation.
Open-ness is stored as _the route it was opened on_, so navigating closes it
without an effect chasing the pathname. The trigger chevron rotates 180° when
open.

The panel wears `.nav-glass` (`globals.css`), not a flat `bg-surface-raised`
fill: the `.studio-glass` blur/saturate treatment plus a coral corner bloom, a
gold bottom-left bloom, and a lit coral→gold hairline along the top edge. The
signature gradient appears as **light on the sheet, never as a fill** — a
gradient background would strand the muted menu text below AA (§2). Menu rows
hover on `bg-ink/[0.07]`, a warm sheen that works on translucency, rather than an
opaque surface token.

**Account control** — the signed-in action is the viewer's own avatar
([`AccountMenu`](../../src/components/layout/account-menu.client.tsx)), not a
labelled "Account" button. Its identity comes from
[`useViewerIdentity`](../../src/features/auth/use-viewer-identity.client.ts),
which reads verified browser claims plus the safe `public_profiles` projection.
That path is **display-only and never an authorization boundary**; an incomplete
or unavailable profile falls back to initials rather than blocking the header.

**Generated-avatar editor** — use visual tiles for eyebrows, eyes, glasses, and
mouth choices; a dedicated **None** choice for glasses; curated color swatches
with an accessible custom-color control; and labelled scale/rotation sliders.
Keep the authoritative preview visible with Save, Cancel, Randomize, and Reset
actions using the established pill controls. At 320px the controls must not
create document overflow. Place DiceBear and Adventurer Neutral attribution in
the editor's explanatory footer, not in every compact avatar instance. Rendering
is local and deterministic; never display a loading state for a remote avatar.

**Header enter/exit** — the shared header animates away when you enter the
Studio ([`ConditionalHeader`](../../src/components/layout/conditional-header.client.tsx)):
it slides up and collapses its height over 340ms so the reclaimed space is
visibly handed to the timeline, and plays in reverse on the way out. That motion
is the only thing that explains why the nav vanished, so keep it. Reduced motion
gets a plain cross-fade. Sticky positioning lives on the animating wrapper, and
clipping is applied _only_ mid-collapse so the dropdown panels can escape the
header box at rest. The landing (`/`) still swaps instantly — it ships its own
overlay nav, so there is nothing to reconcile.

Two traps this animation already fell into, both of which showed up **only when
entering** the Studio (on the way out the header mounts fresh, already correct):

1. **The exiting subtree is still live.** It stays mounted for the full 340ms, so
   anything inside reading `usePathname()` restyles itself mid-fade — the Studio
   link lights up, the identity effect blanks the avatar, open panels slam shut.
   Header components therefore read
   [`useHeaderPathname`](../../src/components/layout/header-route.client.tsx),
   whose value is captured by a provider _inside_ the animated element, so
   `AnimatePresence` freezes it for free. Never reach for `usePathname()` inside
   the header.
2. **Losing the scrollbar shifts the layout.** The Studio locks `body` overflow,
   which reclaims the scrollbar's width and slides the centred container
   sideways — the avatar visibly snapped right mid-animation. `html` now sets
   `scrollbar-gutter: stable` so the track is always reserved.

**Sign-in modal** — [`SignInModal`](../../src/app/sign-in/_components/sign-in-modal.client.tsx)
presents sign-in as a focused modal over a blurred backdrop: a warm scale/fade
entrance and a fade-out on close (Escape, backdrop, or the icon button) that routes
home. It wears the shared `.dash-card` glass with the lit coral→gold top edge, so
signing in looks like the room you are about to walk into. The Google button is a
white pill with the 4-colour Google mark.

Its composition is **type and space, not ornament**: the wordmark to anchor the
modal when it is reached directly, one headline, one line of context, one
button, a hairline, and the terms. An earlier pass put a decorative MIDI
arrangement at the top of it — that was rejected, and rightly: a graphic on a
one-action surface competes with the action instead of serving it. Keep this
surface quiet.

The current headline, "Open beta coming soon!", makes the invite-only state
immediately clear. It replaced a line that greeted visitors into the **retired
prelaunch identity**; do not reintroduce that wording. `npm run check:identity`
fails the build if the old name returns anywhere in tracked text, which is also
why this paragraph does not spell it.

**MIDI library** — `/library` is a browsing surface, so the patterns come first.
The header is an eyebrow and one line, and the nine filters collapse into a
single `.dash-card` toolbar
([`LibraryFilters`](../../src/features/midi-library/library-filters.tsx)):
search, rights and sort stay visible, everything else lives behind a
`<details>` that **opens itself when it holds an active filter**, so a shared
URL never hides why the results look narrow. It is a plain disclosure inside the
GET form — no client JavaScript. Before this, header plus filters ran ~900px and
a 1080p visitor saw no cards at all; the first card now sits at ~380px with three
fully visible.

Cards are `.dash-card` with the hover lift, a stretched title link, and a
staggered `Reveal` entrance capped at eight steps so a full page finishes
arriving quickly. Rights use the badge-length labels
(`MIDI_LIBRARY_RIGHTS_BADGES`) because the full sentence ate the card header —
each card still states what is and is not granted beneath the preview, and the
listing page carries the full statement.

**Browsing pages share one shape.** `/library`, `/library/saved` and `/projects`
are the same surface with different nouns, and changing one should mean changing
all three: `py-6 sm:py-10`, an eyebrow plus a single-line heading with the page's
one primary action beside it, an optional glass control bar, a muted count line,
then a `md:grid-cols-2 xl:grid-cols-3` grid of `.dash-card` cards with a
staggered `Reveal`. Each card is a stretched link to the thing itself with **one**
explicit button — Studio, or the editor. Every one of them has a `loading.tsx`
that mirrors that exact skeleton, so the swap to content is a fill rather than a
relayout.

On a phone these pages tighten with `sm:` variants rather than losing anything:
control bars stay **one scrolling row** instead of wrapping into a tall block of
empty glass, long headings swap to a shorter complete phrasing (two spans, one
displayed — never a truncated sentence), and metric labels abbreviate
(`monophonic` → `mono`) so the row stays a single line. Prefer abbreviating or
scrolling over hiding: a chip a musician uses to choose a clip should not vanish
at 390px.

`/projects` also surfaces the `scope` and `review` filters
([`ProjectScopeTabs`](../../src/features/projects/project-scope-tabs.tsx)) that
`listProjectsForViewer` always supported but which were previously reachable only
by hand-written URL. Its bar is shrink-wrapped — a full-bleed glass strip behind
three short chips reads as an empty container.

**Pattern previews are real note data.** [`PatternRoll`](../../src/features/midi-library/pattern-roll.tsx)
draws the listing's actual notes — pitch on the vertical axis, tick position and
length on the horizontal, velocity in the alpha — and the play button sweeps a
linear playhead across it. It replaced a twelve-bar fake equaliser whose heights
were a hard-coded array; §5 asks musical surfaces to show note timing rather
than an invented waveform, and the note data was already on the listing.

**Studio surface** — manifest-v3 sessions use the browser-only
[`MidiStudioSurface`](../../src/features/studio/midi-adapter/midi-studio-surface.client.tsx)
with the shared
[`ArrangerWorkspace`](../../src/features/studio/arranger/arranger-workspace.tsx):
gold MIDI note summaries sit in dark plum lanes with fixed compact channel strips,
musical bar/beat inspection, and react-icon transport/zoom/follow actions. Clip
duration is presented in bars with one-beat adjustments; persistence ticks remain
an internal implementation detail. Repeating clips show source-pass boundaries and
a repeat count, expose a visible options action as well as right-click, and use a
keyboard-accessible right-edge handle for trimming or extension. Extending past one
source pass enables repeat, while turning repeat off safely trims the arrangement
clip to the remaining immutable source span.
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

**Challenge pages** — a challenge detail page leads with a `.challenge-hero`
glass header (defined in `globals.css`): the same raised-surface gradient as
`.dash-card`, plus an accent bloom in the top-right and a hairline gradient
seam along its top edge. Presentation codes (`.challenge-pulse`,
`.challenge-nocturne`, `.challenge-sunrise`) only retint the hero's
`--challenge-accent`; they must never draw a coloured bar or block of their own.

The hero carries everything that frames the challenge — phase chip, title, prompt
and description in the main column, the countdown pinned to the **top** right so
the two columns start level, and a hairline-separated credits row with the
host/judges above an "Eligibility and use" line. Legal and credit copy is
supporting material: it belongs as small print inside the hero — plain text, not
a disclosure a visitor has to open — never as its own full-width card competing
with the rules. Nothing on the page exposes internal
plumbing (constraint schema version, hash prefix) to visitors — that lives in
admin.

Phases read in plain language via `phaseLabels`: **Upcoming**, **Ongoing**,
**Finished** — not the state-machine words `scheduled`/`open`/`completed`.

Site-issued challenges are not reportable. `ChallengeReportControl` belongs on
entries (user-submitted) only; offering "report this challenge" invites people to
flag the site's own content.

Two rules follow from what a visitor actually needs to know:

- **One deadline, not five.** A challenge carries five frozen dates, but only
  one answers "how long have I got?".
  [`nextChallengeMilestone`](../../src/features/challenges/challenge-countdown.tsx)
  picks it by phase and `ChallengeCountdown` renders it as a gradient numeral
  plus unit ("2 days"), with the exact datetime beneath it in mono. Whole units
  only — days above 48h, then hours, then minutes. Prose elsewhere on the page
  uses `formatRemainingLong` ("3 days and 4 hours"): always say how long the
  wait is, never just that a wait exists.
- **The schedule is a track, not a table.**
  [`ChallengeTimeline`](../../src/features/challenges/challenge-timeline.tsx)
  draws four stops (Opens / Submissions close / Voting / Results) with a
  gradient fill showing elapsed progress: vertical on mobile, horizontal from
  `sm`. Voting collapses to a single node carrying its range.

A challenge that has not opened yet has exactly one thing to say, so it says it
in `.challenge-cue`: a centred accent card whose edge is lit by a conic gradient
travelling around it (`--cue-angle`, animated via `@property`) over a static
accent rim. Exactly one thing moves — the glow around it is fixed. An earlier
version also pulsed the box-shadow's alpha and radius, and a card brightening and
dimming under the reader looks like a rendering fault, not emphasis; if a surface
needs attention, move one element steadily rather than modulating the whole
thing. Reserve the cue for a page's single most important waiting-state line — it
is loud on purpose, and a page with two of them has neither. The global
`prefers-reduced-motion` rule parks the arc and leaves a legible accent card.

The **index** (`/challenges`) sorts by what a visitor can act on — ongoing, then
voting, then upcoming, then finished — because a reverse-chronological list buries
the only challenge still taking entries. Each card answers what it is, whether you
may still enter (phase chip plus a compact countdown), and its limits (the first
three constraint chips plus a `+N more`), then hands off; the frozen dates belong
to the detail page.

Constraints are the point of a challenge, so they get the page's most deliberate
treatment: `.dash-card` tiles two to a row with gradient ordinals — plain `1`,
`2`, `3`, not zero-padded — never a stack of grey strips. `describeChallengeConstraintsV1` throws on non-canonical input —
always call it inside `try`/`catch` and fall back to the "no extra constraints"
empty state rather than 500ing the page.

Gradient text uses `from-accent to-accent-2 bg-linear-to-r bg-clip-text
text-transparent`, **not** `.cta-gradient` — that class is a button recipe and
also sets `color` (unlayered, so it beats `text-transparent`) and a drop glow.
Give clipped gradient text a line-height above `1`; `leading-none` makes the
element box shorter than the glyphs and shears their tops off.

**Labels** — see §3.

---

## 6. Layout & spacing

- **Container**: `max-w-[var(--content-width)]` (**90rem**) via
  [`Container`](../../src/components/layout/container.tsx), which now accepts an
  optional `id` for in-page section anchors. This is a workspace width, not an
  article width — the dashboard is a console, and the header has to share its
  left edge, so it is one shared value rather than a per-route opt-out. Two
  consequences to keep in step:
  - The **landing pins its own 76rem** (`--page` in `landing.module.css`)
    because its hero, section rhythm and line lengths were composed at that
    measure. It deliberately does not follow the app shell.
  - The Studio is a full-bleed exception and never renders a `Container` — which
    is why `globals.css` pins `--content-width` to its unscaled pixel equivalent
    (`calc(90 * 16px)`) while `[data-studio-scale]` is active. **That multiplier
    must move with the token**; the fluid rem scale would otherwise widen the
    header's container mid-slide-away and throw the nav rightward.
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
| Header / nav              | `src/components/layout/header-nav.client.tsx`                             |
| Dashboard launcher        | `src/app/dashboard/page.tsx`                                              |
| Dashboard resume band     | `src/features/dashboard/resume-band.tsx`                                  |
| Dashboard rows + headers  | `src/features/dashboard/launcher-lists.tsx`                               |
| Shared nav IA             | `src/components/layout/nav-items.ts`                                      |
| Workspace nav (4 items)   | `src/components/layout/primary-navigation.client.tsx`                     |
| Mobile tab bar + sheets   | `src/components/layout/mobile-tab-bar.client.tsx`                         |
| Mobile mount + join dock  | `src/components/layout/conditional-mobile-nav.client.tsx`                 |
| Shared viewer identity    | `src/components/layout/viewer-identity-provider.client.tsx`               |
| Nav dropdown panel        | `src/components/layout/nav-menu.client.tsx`                               |
| Avatar account menu       | `src/components/layout/account-menu.client.tsx`                           |
| Header enter/exit motion  | `src/components/layout/conditional-header.client.tsx`                     |
| Brand mark (shared logo)  | `src/components/layout/brand-mark.tsx`                                    |
| Sign-in modal             | `src/app/sign-in/_components/sign-in-modal.client.tsx`                    |
| Library toolbar           | `src/features/midi-library/library-filters.tsx`                           |
| Library card              | `src/features/midi-library/listing-card.tsx`                              |
| Pattern roll preview      | `src/features/midi-library/pattern-roll.tsx`                              |
| MIDI Studio surface       | `src/features/studio/midi-adapter/midi-studio-surface.client.tsx`         |
| Unified arranger          | `src/features/studio/arranger/arranger-workspace.tsx`                     |
| Integrated MIDI composer  | `src/features/studio/integrated-midi/integrated-midi-composer.client.tsx` |
| Shared MIDI piano         | `src/features/midi/stems/stem-editor.client.tsx` and `piano-roll.ts`      |
| Icons                     | `react-icons` (Feather set, `react-icons/fi`)                             |
| Page-transition wrapper   | `src/app/template.tsx`                                                    |
| Musical key formatting    | `src/features/projects/musical-key.ts`                                    |

---

## 9. Open follow-ups

- **Release identity**: the canonical featured challenge card is live on the
  landing and dashboard. RELEASE-01 completed the coordinated OpenMIDI product
  and technical namespace reset while preserving the established visual system.
  Prelaunch musical data compatibility remains intentionally unsupported.
- **Self-hosted display face**: the serif accent currently relies on
  Palatino/Georgia system fallbacks. A self-hosted display face (inlined, no CDN)
  would sharpen the identity further.
