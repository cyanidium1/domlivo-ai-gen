# UI Stabilization Report

**Date:** 2026-03-28
**Task:** Fix layout/overflow, spacing, image preview visibility, and form/preview panel balance. No redesign, no business logic changes.

---

## 1. Summary

Fixed overflow and layout instability across the two-panel listing session editor. All changes are structural CSS/Tailwind fixes. No component logic, business rules, publish contracts, or AI prompts were touched.

TypeScript: `tsc --noEmit` passes with zero errors after all changes.

---

## 2. Files Changed

| File | Change type |
|---|---|
| `src/components/listing-session/Form.tsx` | Grid columns, left panel overflow, messages height, input area stickiness |
| `src/components/listing-preview/ListingPreviewPanel.tsx` | Header layout, badge overflow, gallery thumbnails, dl/dd overflow |
| `src/components/listing-preview/ListingPreviewSlider.tsx` | Image container height, img sizing, gradient fix, empty state height |
| `src/app/globals.css` | Prevent horizontal scroll on html/body |

---

## 3. Changes by File

### 3.1 `src/components/listing-session/Form.tsx`

**Problem:** Right panel grid column had `minmax(320px,1fr)` — the 320px minimum forced the right panel to overflow the viewport at intermediate widths (~1029px), causing horizontal scroll and collapsing the preview panel to ~260px actual width.

**Problem:** Left panel used `lg:flex lg:h-[calc(100vh-112px)] lg:flex-col` — a fixed-height flex column that made the open `<details>` Advanced Edit section overflow the container with no scroll handler.

**Problem:** Input bar had `lg:sticky lg:bottom-0` inside the flex column — this produced stacking context conflicts at certain scroll positions.

**Fixes:**

| Location | Before | After |
|---|---|---|
| Grid wrapper | `lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]` | `lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]` |
| Left `<section>` | `lg:flex lg:h-[calc(100vh-112px)] lg:flex-col` | `lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-104px)] lg:overflow-y-auto` |
| Messages `<div>` | `h-[42vh] min-h-[280px] lg:h-auto lg:flex-1 overflow-y-auto` | `h-[42vh] min-h-[280px] max-h-[480px] overflow-y-auto` |
| Input wrapper `<div>` | `lg:sticky lg:bottom-0` (removed) | _(class removed)_ |
| Right `<aside>` | `lg:overflow-auto` | `overflow-hidden lg:overflow-y-auto` |

---

### 3.2 `src/components/listing-preview/ListingPreviewPanel.tsx`

**Problem:** Header row with title + "Not ready" badge was a single `flex justify-between` row with locale tabs on the same row. The badge text `"Publish ready"` / `"Not publish-ready"` would wrap and push locale tabs off-screen at narrow widths.

**Problem:** Gallery thumbnails had `min-w-24` (sets minimum but allows growth) — should be `w-24 flex-shrink-0` (fixed width, no shrink).

**Problem:** `<dl>` fact rows had no `min-w-0` guards — long monospace refs broke out of grid cells.

**Problem:** Price/title hero row had no `flex-shrink-0` on price — it could collapse under text pressure.

**Fixes:**

| Location | Before | After |
|---|---|---|
| Header layout | Single row: title + badge + locale tabs | Two rows: row 1 = title+badge, row 2 = locale tabs |
| Badge text | `"Publish ready"` / `"Not publish-ready"` | `"Ready"` / `"Not ready"` |
| Badge classes | _(no shrink/wrap guards)_ | `flex-shrink-0 whitespace-nowrap` |
| Gallery thumbnail | `min-w-24` | `w-24 flex-shrink-0` |
| `dl` rows | _(no min-w-0)_ | `grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 min-w-0` on wrapper |
| `dd` elements | _(no overflow guard)_ | `break-words min-w-0` |
| Title/price hero row | _(no min-w-0 on text side)_ | `min-w-0` on text div, `flex-shrink-0` on price div |
| Gallery alt list items | _(no overflow guard)_ | `break-all` |
| `coverImage` ref span | _(no overflow guard)_ | `break-all` on wrapper and span |
| Section wrapper | _(no overflow guard)_ | `min-w-0 overflow-hidden` |

---

### 3.3 `src/components/listing-preview/ListingPreviewSlider.tsx`

**Problem:** Image container used `min-h-[180px]` with no explicit height — the `<img>` inside used `h-[220px]` which exceeded the container, causing it to overflow and produce visual glitches.

**Problem:** `bg-linear-to-t` is a Tailwind v4 utility that is not universally supported in this build. The gradient was not rendering.

**Problem:** Empty state ("No photos uploaded") had no height — it collapsed to a single line, breaking visual balance with the non-empty state.

**Fixes:**

| Location | Before | After |
|---|---|---|
| Image container | `min-h-[180px]` | `h-[200px]` (explicit) |
| `<img>` sizing | `h-[220px] w-full` | `h-full w-full` |
| Gradient class | `bg-linear-to-t` | `bg-gradient-to-t` |
| Empty state | _(no height)_ | `h-[200px] flex items-center justify-center` |

---

### 3.4 `src/app/globals.css`

**Problem:** No `overflow-x: hidden` on `html`/`body` — any element that momentarily exceeded viewport width (before grid reflow) caused a horizontal scrollbar.

**Fix:** Added `overflow-x: hidden` to the `html, body` rule block.

---

## 4. What Was NOT Changed

- No business logic, publish contracts, validation schemas, or AI prompts.
- No component API shapes — all props remain identical.
- No new components or files created (report excluded).
- No Tailwind config changes.
- No redesign — all visual intent matches the original design.

---

## 5. Verification

- `tsc --noEmit`: zero errors.
- Dev server running on port 55732 (autoPort, 3000 was occupied).
- Screenshot taken at 1100×800 viewport: two-panel layout renders correctly, no horizontal overflow, badge is not wrapping, locale tabs appear on their own row, slider empty state has consistent height.
