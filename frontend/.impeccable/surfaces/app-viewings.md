---
version: 1
slug: "app-viewings"
primary_target: "app/viewings"
related_targets: []
---

THESIS: Operate. A personal movie diary, with poster-led records and separate reading and writing surfaces.

OWN-WORLD: Repov official screenshots at https://page.repov.me/ show compact poster rows, understated filters and calendar covers. Borrow this hierarchy, not marketing backgrounds or unrelated features. Preserve Reelink's neutral light/dark palette.

STORY: /viewings lists records; /viewings/new selects a movie then records the experience; /viewings/:id reads it; /viewings/:id/edit edits it. Calendar is a later alternate view of these same records.

FIRST VIEWPORT: Brand and account actions, My records title, add action, compact rating/sort filters, first poster rows. Mobile uses the same hierarchy without a sidebar.

FORM: Native date and optional time; half-star rating; conditional theater/streaming/other inputs. Search and selection share one theater control. User explicitly pinned Repov and approved direct app implementation, so no concept-seed tournament. Preserve drafts in tab session storage, scoped by user and record.

FINISH: Complete routes, keyboard and mobile verification, error and draft checks, then bounded reviewer and documentation handoff. No poster backfill, new dependencies or calendar implementation in this slice.
