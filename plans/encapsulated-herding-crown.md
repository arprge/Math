# Quieter, on-demand service-status hint

## Context
Warranty Keeper aims for a maximally clean interface. The `RiskFlag` block
(`src/App.tsx:631`) currently prints a colored dot, an uppercase label, and a
full recommendation sentence on **every** receipt card (rendered at
`src/App.tsx:585`). In a now-denser grid (3 cols at `lg`, 4 at `xl`) this
sentence is visually loud and repeats across every card, competing with the
hero time-remaining stat.

The user wants these hints to (a) stand out less and (b) surface optionally
rather than always. Following standard product-UI guidance for dense card
grids, the fix is **progressive disclosure**: keep a minimal persistent signal,
reveal the detail only on interaction.

## Approach

### 1. Persistent minimal signal (quiet by default)
In `RiskFlag` (`src/App.tsx:647-660`) keep the colored status dot + the small
uppercase `label` always visible, but make the recommendation sentence a
disclosed detail rather than always-on text.

- Selected label `div` (line 652): keep, it is the quiet persistent cue.
- Selected recommendation `<p>` (line 655): move into the disclosed region and
  soften (`text-muted` instead of `text-ink`) so even when shown it reads as
  secondary.

### 2. Reveal on demand
Wrap the recommendation in a container that is collapsed by default and
expands on hover/focus of the card, using Tailwind `group` utilities:

- Add `group` to the card root at `src/App.tsx:519`
  (`receipt-card relative` → `receipt-card relative group`).
- The recommendation wrapper: `max-h-0 opacity-0 overflow-hidden
  transition-all duration-200 group-hover:max-h-16 group-hover:opacity-100
  group-focus-within:max-h-16 group-focus-within:opacity-100`.
- Keep it accessible: the collapsed content stays in the DOM (screen readers
  still read it); no `display:none`.

This keeps the resting state clean (dot + tiny label only) and shows the
guidance sentence when the user engages a card.

## Files
- `src/App.tsx`
  - `RiskFlag` component (~lines 647-660): restructure into persistent
    label + disclosed recommendation; soften recommendation color.
  - Card root (~line 519): add `group`.

## Scope note
This goes slightly beyond the two originally-selected text nodes (it touches the
`RiskFlag` wrapper and the card root's class) — required to make the hint
"optional/on-demand". No other cards, components, or unrelated UI change.

## Verification
- Dev server is already running; open the preview.
- Resting grid shows only the colored dot + tiny uppercase label on each card —
  no recommendation sentence, noticeably calmer.
- Hovering a card smoothly reveals the (muted) recommendation; moving away
  collapses it.
- Tab to a card's interactive content — `group-focus-within` reveals the hint
  for keyboard users.
- Check `expired`/`high`/`watch`/default levels still map to correct dot color
  and label.
