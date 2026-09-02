# Frontend Instructions

- Keep one Next.js App Router application. Put admin pages under `/admin`; do not create a separate admin app.
- Call the backend through same-origin `/api`. Treat backend session and role data as authoritative.
- Prefer Server Components, native browser behavior, and existing dependencies. Add client state or UI packages only when the changed flow needs them.
- Preserve loading, empty, error, keyboard, focus, and mobile states for user-visible work.
- Run the narrowest relevant check first. For production-impacting changes, run `pnpm --dir frontend lint` and `pnpm --dir frontend build` from the repository root.
- For user-visible changes, apply `web-design-guidelines`, then verify desktop and mobile behavior, console errors, and the changed network flow with `playwright-cli`.
