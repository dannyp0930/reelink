---
name: Reelink
description: Observed movie diary interface, implementation snapshot dated 2026-09-16
colors:
  background-light: "#ffffff"
  foreground-light: "#171717"
  background-dark: "#0a0a0a"
  foreground-dark: "#ededed"
typography:
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
  record-title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.555556
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.5
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    lineHeight: 1.428571
  metadata:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.75rem"
    lineHeight: 1.333333
rounded:
  md: "0.375rem"
  xl: "0.75rem"
spacing:
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
components:
  button-primary:
    backgroundColor: "var(--foreground)"
    textColor: "var(--background)"
    rounded: "{rounded.xl}"
    padding: "0.5rem 1rem"
  button-secondary:
    textColor: "var(--foreground)"
    rounded: "{rounded.xl}"
    padding: "0.5rem 1rem"
  field:
    backgroundColor: "var(--background)"
    textColor: "var(--foreground)"
    rounded: "{rounded.xl}"
    padding: "0.5rem 0.75rem"
  record-row:
    padding: "1.25rem 0"
  pagination:
    textColor: "var(--foreground)"
---

# Design System: Reelink

## Overview

**Creative North Star: "Reelink movie diary"**

This is a source-based implementation snapshot, not approval of a final brand identity. It records the neutral light/dark interface retained during the approved direct app build. The factual North Star names the product; it introduces no new visual metaphor.

Repov informed record hierarchy. Surface composition and the later calendar belong in [.impeccable/surfaces/app-viewings.md](.impeccable/surfaces/app-viewings.md). Sources are `app/globals.css` and `app/viewings/{shared,shell,record-list,record-form}.tsx`. This documenter pass inspected code; browser evidence belongs to the parent review in `.impeccable/review/`.

**Key Characteristics:**
- Neutral surfaces with foreground-filled primary actions.
- Native fields, visible focus, and compact record metadata.
- Movie posters within a single-column record hierarchy.

## Colors

### Primary

Primary actions invert the current foreground/background pair. There is no separate brand accent in the sampled implementation.

### Neutral

Light and dark pairs come directly from the global stylesheet. The operating system selects the pair through `prefers-color-scheme`; component snippets inherit `--background` and `--foreground`. Foreground opacity supplies borders (30%), separators (15%), muted text (65–70%), and hover fills (5–10%). These are treatments of existing colors, not new palette commitments.

## Typography

Arial with Helvetica and sans-serif fallbacks is the observed body stack. Title, record-title, body, label, and metadata roles above describe the current hierarchy. Form labels use medium weight; action labels use semibold. Dates, ratings, and pagination use tabular numerals. List titles use tight tracking; form titles do not. This is native application typography, not a new display-font identity.

## Layout

The shell centers within a maximum width of 56rem, with 1.25rem horizontal padding increasing to 2.5rem at the 40rem breakpoint. Main vertical padding increases from 2rem to 3rem there. Forms cap at 42rem; their two-column field grid starts at the same breakpoint. Filters wrap. Text containers shrink and wrap beside fixed posters (60 × 90px). Record rows use 1rem gaps and the documented vertical padding. Page composition remains surface-specific.

## Elevation & Depth

The sampled record interface uses borders, separators, and subtle foreground fills. It defines no reusable shadow or motion vocabulary. No invented elevation tokens are included.

## Shapes

Controls use the xl radius, while posters use md. Shared buttons and fields have a minimum height of 3rem. Poster images retain their complete proportions within their frame. Rows are divided by lines rather than wrapped in separate cards.

## Components

- **Buttons:** outlined secondary and foreground-filled primary variants share spacing and semibold labels. Secondary hover uses a foreground tint; primary hover lowers opacity to 85%. Keyboard focus has a 2px outline with 4px offset. Disabled buttons use 50% opacity.
- **Fields:** native input/select/textarea controls use a background fill, 30% foreground border, body-size text, and a 2px focus outline with 2px offset. Labels remain visible above controls.
- **Record rows:** an entire row links to its detail. Date, title, rating/context, and optional two-line note sit beside the poster. Hover adds a 5% foreground fill; focus receives a 2px outline.
- **Navigation:** pagination reuses outlined buttons around a tabular page count. The current list indicator and unavailable calendar text are surface state, not a reusable interactive tab system.
- **Rating:** the existing half-star radio control uses inline SVG, keyboard focus, and accessible labels. Selected viewing-type buttons reuse the primary button treatment; there is no separate chip system.

## Do's and Don'ts

### Do:
- Do reuse the existing theme variables and shared control treatments when extending these record screens.
- Do preserve visible labels, keyboard focus, native field behavior, and poster fallback states.

### Don't:
- Don't treat this implementation snapshot as approval of a final brand redesign.
- Don't infer calendar, chip, card, shadow, or motion systems that the sampled code does not implement.
