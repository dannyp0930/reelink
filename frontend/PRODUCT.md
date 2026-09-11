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
- Current implementation has Google authentication, TMDB search/selection, viewing CRUD APIs, and a single-page entry UI with half-star input. Mocked desktop/mobile entry tests pass; real-account integration, routes, saved-record posters, query pagination, filters, and calendar remain unfinished.
- Viewing time/type, streaming/other details, runtime enrichment, and cinema search are planned, not implemented. Next implementation proposal: C1 data contract and migration; complete Repov visual evidence before D screen implementation. See the UI plan for C1/C2/C3 sequencing and legacy-data rules.
- Next.js App Router and NestJS/Prisma remain in place. Browser requests use same-origin /api; Backend enforces session ownership. Never expose server credentials.
- Goods automation and notifications are deferred. No social feeds, maps, recommendations, or image-upload feature in the record UI scope.

## Brand Commitments

Keep the name Reelink. Repov is the user's UI benchmark. Preserve concise Korean copy without obvious usage instructions; retain labels and actionable error/status feedback. The existing scaffold is not an approved final visual identity.

## Evidence on Hand

- Existing code, domain schema, and test history are recorded in docs/project-status.md and docs/movies-api.md.
- Repov's official introduction confirms multiple record views. Reference images failed to load during initial research; exact visual benchmarking is still pending.
- Confirmed colors, typography, spacing, and a production design system do not exist yet. Do not invent approval for them.

## Product Principles

- Show the same private records in multiple useful views; do not build unrelated duplicate data models.
- Keep half-star ratings and date-only viewing semantics exact.
- Preserve drafts, ownership checks, and honest failure states.
- Apply the smallest complete implementation and verify desktop/mobile behavior.

## Open Decisions

Initial/default view persistence, query/pagination contracts, draft retention details, and final visual styling remain implementation proposals in the UI plan. No image-first/code-first standing workflow preference has been selected. Do not choose one during documentation work.
