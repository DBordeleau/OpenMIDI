# Supabase operating contract

This file applies to the `supabase/` subtree. Root commands and global rules remain authoritative in `../AGENTS.md`.

- Add forward-only, timestamped, reviewed migrations only for real schema decisions. Never edit an applied migration; add a new one.
- In the PR that creates an exposed application table, enable RLS and test allowed and denied actors. Do not use service-role shortcuts in tests intended to prove user authorization.
- Verify migration changes with a clean reset, pgTAP, database lint, generated-type drift checking, and the required actor-denial cases.
- Model frequently changing taxonomies with tables, not Postgres enums.
- Security-definer functions must set a fixed `search_path`, authorize `auth.uid()`, and receive only the minimum execute grants.
- Keep seed data deterministic and non-sensitive. Never include production exports.
- Never hand-edit `src/lib/supabase/database.types.ts`; regenerate it from the local schema.
- Use the exact local commands documented in the root `AGENTS.md`; do not duplicate a drifting command list here.
- Never commit local `.temp`, branches, volumes, dumps, keys, secrets, or other generated runtime state.
