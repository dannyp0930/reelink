# Reelink product context

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner is building a personal movie-going journal, used on mobile-width browsers and desktop, with development continuing across Windows and macOS PCs. Public social networking is out of scope.

## Product Purpose

Record each movie viewing and revisit the same records as a list or monthly calendar. Later connect movies, cinemas, and manually managed movie goods information.

## Operating Context

On 2026-09-11 the user approved the list/calendar wireframe and requested a documented implementation plan. The approved structure and delivery gates live in [the UI plan](../docs/viewing-ui-plan.md); actual completion and verification live in [project status](../docs/project-status.md).

## Capabilities and Constraints

- One viewing is one record; repeat viewings of the same movie remain separate.
- Approved expansion on 2026-09-11: viewing date means year/month/day, with optional local time. It is separate from the movie's release year and runtime, which come from TMDB. Missing viewing time is not midnight; preserve the recorded calendar day without timezone conversion.
- Theater, OTT, and other viewings belong to the same record model and list/calendar. Show conditional fields: internal Cinema search plus auditorium/format for theater; platform suggestions/custom entry for OTT; a small category list/custom entry for other. Keep time, type, and location details optional as the implementation proposal. Do not infer OTT from a missing cinema.
- Movie selection/detail should show release year and runtime when available, without fetching every search result's details. No streaming availability lookup, OTT account integration, maps, or statistics in this expansion. Existing cinema IDs and records must survive migration.
- Ratings: the API supports 0 through 5 in 0.5 steps; unrated is null, not zero. The entry UI shows only stars (0.5 through 5), with no numeric caption, zero button, or unrated button. Clicking the selected half-star again or pressing Delete clears to unrated. Storage still supports integer half-star units 0 through 10; existing zero ratings are preserved.
- List and calendar share rating filters, record details, editing, and deletion. Calendar selection shows all records for that day; adding from a date prefills the viewing date. These are approved target behaviors, not claims of completed implementation.
- The entry flow is movie search, selection, viewing information, save, then detail. Return navigation preserves the prior view and position. Drafts must not be silently lost on failures or navigation.
- Current implementation includes Google authentication, TMDB search/selection, viewing CRUD APIs, and separate list/new/detail/edit routes. The list has rating/sort/page controls. Entry supports date, optional local time, half-star ratings and conditional theater/OTT/other details. Calendar and real-account integration remain later work.
- C1-C3 APIs and D routes are implemented; desktop/mobile fixture checks passed on 2026-09-16. B uses actual official Repov screenshots inspected on 2026-09-15. Real-account integration remains F. Cinema registration is in docs/cinemas-api.md; query contracts are in docs/viewings-api.md. Calendar must fetch every month page and show incomplete/error state on partial failure.
- Next.js App Router and NestJS/Prisma remain in place. Browser requests use same-origin /api; Backend enforces session ownership. Never expose server credentials.
- Goods automation and notifications are deferred. No social feeds, maps, recommendations, or image-upload feature in the record UI scope.

## Brand Commitments

Keep the name Reelink. Repov is the user's UI benchmark. Preserve concise Korean copy without obvious usage instructions; retain labels and actionable error/status feedback. The existing scaffold is not an approved final visual identity.

## Evidence on Hand

- Existing code, domain schema, and test history are recorded in docs/project-status.md and docs/movies-api.md.
- Repov official screenshots inspected on 2026-09-15: movie search, compact timeline poster rows, month calendar covers and detail. Source: https://page.repov.me/. Marketing backgrounds are not the app palette.
- The implemented neutral light/dark tokens and components are documented in DESIGN.md as a provisional snapshot, not an approved final brand identity.

## Product Principles

- Show the same private records in multiple useful views; do not build unrelated duplicate data models.
- Keep half-star ratings and date-only viewing semantics exact.
- Preserve drafts, ownership checks, and honest failure states.
- Apply the smallest complete implementation and verify desktop/mobile behavior.

## Open Decisions

Initial view is list; persistence of the last chosen view and final brand styling remain open. Drafts use user/record-scoped tab sessionStorage plus in-memory fallback; save/discard/logout/account switch clear them. The user chose direct app implementation for this screen task, not a permanent global image/code workflow policy. Query/pagination contracts are in docs/viewings-api.md.
