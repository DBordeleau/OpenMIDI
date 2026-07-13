# Architecture Decision Records

ADRs preserve decisions that coding agents must not silently revisit. A changed decision requires a superseding ADR, not an unannounced implementation deviation.

## Accepted for initial implementation

### ADR-001: Next.js application with a client-only studio boundary

- **Decision:** Use Next.js App Router for the product and a dynamically loaded client-only studio feature.
- **Why:** Public/social pages benefit from server rendering while Web Audio and the waveform editor require browser APIs.
- **Consequence:** No browser editor, Tone.js, or Web Audio import may enter a Server Component or shared server module.

### ADR-002: Supabase as identity, relational authority and object storage

- **Decision:** Use Supabase Auth, Postgres and Storage with RLS on all public-schema tables.
- **Why:** It matches the MVP needs and avoids a bespoke service tier.
- **Consequence:** Service-role access is exceptional; ordinary workflows remain user-scoped and policy-tested.

### ADR-003: Immutable revisions with mutable private workspaces

- **Decision:** Published work and submitted contributions are immutable snapshots; autosave targets private workspace drafts.
- **Why:** Reliable attribution, forks, review and recovery require stable history.
- **Consequence:** Acceptance creates a revision rather than updating one.

### ADR-004: Jam Session manifest is the portable workspace authority

- **Decision:** Persist a versioned Jam Session JSON manifest and normalized track projection; do not require an opaque editor-native snapshot for MVP reopen.
- **Why:** The MVP collaboration subset is small enough to model directly, making it server-validatable, migration-friendly, and independent of a particular editor.
- **Consequence:** The Waveform Playlist adapter must deterministically hydrate from and export to the manifest, and publish validates every referenced asset.

### ADR-005: Copy-on-write forks and no automatic audio merge

- **Decision:** Forks reference immutable assets; contribution acceptance requires the expected base revision.
- **Why:** Byte duplication wastes storage, and a Git-like automatic merge is unsafe for musical arrangements.
- **Consequence:** An outdated contribution needs manual rebase/resubmission in MVP.

### ADR-006: Waveform Playlist for the MVP browser studio

- **Decision:** Use pinned Waveform Playlist packages behind `WaveformPlaylistStudioAdapter`; retain Tone.js only where required by the selected playback/export path.
- **Why:** It supplies the MVP's multitrack timeline, synchronized playback, mixer and export capabilities through modular React/TypeScript packages under the MIT license.
- **Consequence:** Jam Session owns serialization, product-specific controls, accessibility integration and manifest migrations. OpenDAW remains a post-MVP alternative and cannot be introduced without superseding this ADR.

## ADR template

```md
# ADR-NNN: Short decision title

Status: Proposed | Accepted | Superseded
Date: YYYY-MM-DD
Owners: names/roles

## Context

What forces the decision?

## Decision

What are we doing?

## Alternatives considered

What credible options were rejected and why?

## Consequences

What becomes easier, harder, required or prohibited?

## Validation

What evidence will confirm the decision remains sound?
```
