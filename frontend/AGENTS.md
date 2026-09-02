# Frontend Instructions

- Keep one Next.js App Router application. Put admin pages under `/admin`; do not create a separate admin app.
- Call the backend through same-origin `/api`. Treat backend session and role data as authoritative.
- Prefer Server Components, native browser behavior, and existing dependencies. Add client state or UI packages only when the changed flow needs them.
- Preserve loading, empty, error, keyboard, focus, and mobile states for user-visible work.
- Run the narrowest relevant check first. For production-impacting changes, run `pnpm --dir frontend lint` and `pnpm --dir frontend build` from the repository root.
- For user-visible changes, apply `web-design-guidelines`, then verify desktop and mobile behavior, console errors, and the changed network flow with `playwright-cli`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
