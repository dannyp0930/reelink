# Reelink Agent Instructions

## Harness Modes

- Use the `caveman` skill in `full` mode for every user-facing Codex reply. Keep the user's language and all technical terms. Drop it only when brevity could make a security warning, irreversible action, or ordered procedure ambiguous.
- Use the `ponytail` skill in `full` mode for every coding task, including design, implementation, fixes, refactors, and code review. Read the affected flow first, reuse existing code and dependencies, and stop at the smallest correct implementation.
- Use `superpowers` workflows for complex planning, systematic debugging, or test-driven development. Do not impose a heavyweight workflow on a trivial change.
- Use `vercel-react-best-practices` when writing, reviewing, or refactoring React or Next.js code. Apply rules relevant to the changed flow; do not add speculative optimization.
- Use `web-design-guidelines` as the final code review for user-facing UI changes. Review the changed UI files against the current guidelines and report actionable `file:line` findings.
- Use `playwright-cli` to verify user-visible frontend behavior after the relevant local server is running. Cover the changed desktop flow and a mobile viewport; inspect console errors and close the browser session.
- Use Codex Security's `security-diff-scan` after changes to authentication, authorization, secrets, payments, uploads, parsing, or other trust boundaries. Run a repository-wide security scan only when the user asks.
- Use the `humanize-korean` skill as the final prose pass whenever creating or substantially rewriting Korean documentation. Preserve facts, code, commands, identifiers, links, numbers, and quotations exactly.
- Do not run `humanize-korean` over source code, config files, diffs, commit messages, logs, or machine-readable output.
- When scopes overlap, apply them in this order: scope with `ponytail`, use `superpowers` only if task complexity warrants it, apply relevant domain and security checks, verify UI with `playwright-cli`, polish Korean documentation with `humanize-korean`, then report with `caveman`.
- Task-specific skills may add checks or domain guidance, but they must not expand requested scope or override `ponytail`'s implementation limits.
- If a named skill is unavailable, state that once and follow its intent from this file. Never claim a missing skill ran.

## Repository Workflow

- Use `pnpm`; do not add another package manager.
- Inspect existing patterns before adding files, abstractions, or dependencies.
- Keep changes scoped to the request. Do not add speculative infrastructure.
- Preserve input validation, security, accessibility, and error handling that prevents data loss.
- After frontend changes, run the narrowest relevant check, then `pnpm --dir frontend lint` and `pnpm --dir frontend build` when the change can affect production output.
- For user-facing frontend changes, start the app and complete the `web-design-guidelines` and `playwright-cli` checks before closeout.
- After backend changes, run the narrowest relevant test, then `pnpm --dir backend lint`, `pnpm --dir backend test`, and `pnpm --dir backend build` when applicable.
- Do not commit, push, publish, deploy, or mutate external services unless the user explicitly asks.

## Documentation

- Prefer short, task-focused documentation. Record commands that were actually verified.
- Keep technical names and literal commands unchanged during prose polishing.
- Do not create prompt-only handoff files; put durable rules here and task-specific results in chat.
