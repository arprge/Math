# GUARDPOST — Reachable, single-row controls

## Context
The app was restored to a version where all controls (four filter pills, the List/Receipt
view toggle, and the "+ Register item" button) live in a single top wrapping bar
(`src/App.tsx:195–241`). On phones this bar sits at the very top of the page and scrolls
away, so the primary actions are hard to reach one-handed and the pills wrap into a wide,
busy block.

Goal (in the user's words): make the filter options **less wide**, pull the controls
**closer to the bottom** (reachable regardless of left/right-handedness), ideally keep
everything in **one row** — filters on the left, display options + Register on the right —
and reclaim vertical space by tightening the top elements' padding, **without making the UI
too dense**.

All work is in `src/App.tsx` and `src/index.css`. No new dependencies.

## Approach

### 1. Collapse the four filter pills into one segmented control (`App.tsx:197–210`)
The single biggest width/density win. Instead of four separately-bordered pills with gaps,
render them as one bordered segmented control — same pattern already used by the view toggle
at `App.tsx:213–232` (shared border, `border-l` dividers, no inter-item gap).
- Reuse the existing `filter` state and `setFilter` handler; keep the `counts[f]` numbers but
  demote them to a small dimmed superscript so labels read `ALL·12` compactly rather than
  `ALL /12`.
- Tighten each segment to `px-2.5 py-1.5` and keep `text-[10px] uppercase tracking-[0.12em]`
  to match the view toggle exactly, so the two controls read as one visual family.

### 2. One-row layout: filters left, display + Register right
Keep the outer `flex items-center justify-between` bar (`App.tsx:196`), but stop it from
wrapping into multiple lines on normal widths:
- Left group: the new filter segmented control.
- Right group: the List/Receipt view toggle (`App.tsx:213–232`) + the "+ Register item"
  button (`App.tsx:235–240`), grouped in a `flex items-center gap-2`.
- Shorten the primary button label to `+ Add` on small screens (keep "+ Register item" on
  `sm+` via a `hidden sm:inline` span) so the single row survives narrow widths.

### 3. Mobile: anchor the control row into the thumb arc (reachability)
So the controls are reachable by either hand, on `< sm` turn the controls bar into a fixed,
centered bottom bar; on `sm+` it stays inline at the top (current position).
- Wrapper classes: default `fixed inset-x-0 bottom-0 z-40` + `sm:static sm:z-auto`.
- Center the content and cap its width (`mx-auto max-w-md`) so both thumbs reach it, and lift
  it off the very edge — small bottom offset plus safe-area:
  `padding-bottom: calc(0.5rem + env(safe-area-inset-bottom))`. This keeps it "higher than the
  very bottom" and clear of the iPhone home indicator.
- Give it a paper backdrop with a top hairline and soft shadow so it floats above the list
  (`bg-paper/95 backdrop-blur border-t border-line shadow-[0_-6px_20px_rgba(17,17,16,0.08)]`),
  and add matching bottom padding to `<main>` (`pb-24 sm:pb-4`) so the last cards aren't hidden
  behind it.
- Add a small `.controls-safe` helper in `src/index.css` for the `env(safe-area-inset-bottom)`
  padding (Tailwind can't express `calc()` with `env()` cleanly here).

### 4. Reclaim vertical space + keep it airy (avoid density)
Tighten the stacked top elements so content starts higher and the bar has room:
- Header: `py-3 → py-2.5` (`App.tsx:170`).
- Main: `py-5 → py-4` (`App.tsx:186`).
- Stat band: `mb-6 → mb-4` (`App.tsx:188`); controls bar `mb-5 → mb-4` (`App.tsx:196`).
Counter density with breathing room, not more borders: rely on the two segmented controls
(fewer visible edges than four pills), keep `gap-2` between the right-hand group, and let the
bottom bar center itself with whitespace on either side rather than stretching edge-to-edge.

## Files to modify
- `src/App.tsx` — controls bar (`195–241`), header/main/stat paddings (`170`, `186`, `188`),
  `<main>` bottom padding for the mobile bar.
- `src/index.css` — one `.controls-safe` safe-area padding helper.

## Verification
- Dev server is already running on `$PORT`; open the preview.
- Desktop (`sm+`): filters render as one segmented block on the left; view toggle + Register
  on the right; everything on a single row; top spacing visibly tighter.
- Mobile (narrow the viewport / device toolbar): controls detach into a centered floating
  bottom bar within thumb reach, not flush to the very bottom, not clipped by the home
  indicator; the last list/receipt cards remain fully visible above it (no overlap).
- Click each filter and both view toggles — state still drives the list/receipt views; counts
  still update. "+ Add" still opens the dialog.
