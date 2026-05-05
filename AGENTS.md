# Codex Project Rules

- When a change affects user-facing behavior, game logic, contracts, integrations, wallet flow, Base App readiness, or admin operations, update `packages/frontend/app/docs/page.tsx` and `packages/frontend/lib/updates.ts` in the same change.
- If a change does not require docs or update-log edits, state the reason in the final response.
- Keep Base App integration aligned with the current standard web app model: wagmi/viem wallet identity, Base.dev metadata, standard browser links, and no Farcaster-only runtime dependency for core app behavior.
- Do not add mock production data. Prefer live Supabase data with on-chain event fallback, or clearly label local-only UI state.
- After frontend edits, run `npm run typecheck --workspace @baseplay/frontend` and `npm run build --workspace @baseplay/frontend`.
