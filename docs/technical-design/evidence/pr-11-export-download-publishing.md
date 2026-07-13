# PR 11 export, download, and workspace publishing evidence

Status: implementation complete with bounded verification
Date: 2026-07-13

## Landed behavior

- `publish_workspace_revision()` publishes only the saved Postgres workspace manifest by calling the existing canonical `publish_project_revision()` transaction, then advances the workspace base and lock atomically.
- Identical publish retries return the existing immutable revision; stale locks, stale bases, changed request inputs, unrelated actors, suspended actors, and anonymous actors are rejected.
- `restart_project_workspace()` archives a stale workspace and clones the current revision without automatic merge or rebase.
- Revision and workspace stem-export handlers return private, ten-minute download URLs for the exact authorized asset set. Audio bytes are fetched directly from Supabase Storage, sequentially, with active-fetch cancellation and sanitized filenames.
- The source package is multiple original WAV/FLAC/MP3 files plus a safe JSON descriptor, not a server-generated archive.
- The production client adapter now uses the pinned Waveform Playlist `useExportWav()` hook for local stereo 16-bit WAV mix rendering. Export is limited to ten minutes and an estimated 128 MiB; cancellation suppresses the eventual save because the pinned hook has no render-abort API.

## Verification performed

| Check                                    | Result                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean migration reset                    | Passed; the final reset includes the restart idempotency hardening                                                                                    |
| Focused PR 11 pgTAP                      | Passed: 22 tests                                                                                                                                     |
| Database type generation                 | Passed                                                                                                                                               |
| Focused export/adapter Vitest invocation | 7 passed, 1 filename expectation failed; the sanitizer was corrected afterward and was not rerun at the user's request to stop optional verification |
| TypeScript type check after corrections  | Passed                                                                                                                                               |

## Deliberately not run

At the user's request to conserve tokens and runtime, the full `npm run check`, complete database suite, Playwright E2E, audible export check, multi-browser matrix, large-download exercise, expiry wait, and Vercel Preview verification were not run. Existing PR 08–10 green evidence remains reusable for unchanged canonical publishing, playback, and autosave behavior.

## Known limitations

- Mix cancellation cannot interrupt the underlying offline render with the pinned hook; it safely discards the late result.
- Source export intentionally triggers multiple direct downloads rather than retaining a project-sized ZIP in browser/server memory.
- Public/anonymous export waits for the later public visibility and discovery slices.
