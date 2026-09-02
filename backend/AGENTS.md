# Backend Instructions

- Keep one NestJS modular monolith. Share domain code between API and worker entry points; do not split microservices without measured need.
- Use PostgreSQL and Prisma when persistence enters scope. Track migrations and keep generated artifacts out of hand-written domain code.
- Keep Google OIDC, opaque database sessions, authorization, and role checks in the backend. Never trust browser-supplied roles.
- Model collector evidence explicitly. Missing, stale, or conflicting evidence stays `UNKNOWN`; it must not become `AVAILABLE` by default.
- Start collector coordination with PostgreSQL leases, idempotency, timeouts, and retries. Add Redis or BullMQ only after a concrete throughput or isolation trigger.
- Run the narrowest relevant test first. Then run `pnpm --dir backend lint`, `pnpm --dir backend test`, and `pnpm --dir backend build` when applicable.
