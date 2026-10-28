import { useEffect, useRef } from "react"

/** Tab stops that can hold focus inside a dialog. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"]):not(.hidden)',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

/**
 * Keep keyboard focus inside a dialog while `active`, and hand it back to
 * whatever was focused before once the dialog closes.
 */
export function useFocusTrap<T extends HTMLElement>(active = true, onEscape?: () => void) {
  const ref = useRef<T>(null)
  const escape = useRef(onEscape)
  escape.current = onEscape

  useEffect(() => {
    if (!active) return
    const root = ref.current
    if (!root) return

    const saved = document.activeElement as HTMLElement | null
    const focusables = () =>
      [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)

    if (!root.contains(document.activeElement)) {
      const first = focusables()[0]
      if (first) first.focus()
      else root.focus()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        escape.current?.()
        return
      }
      if (e.key !== "Tab") return

      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        root.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      // Focus starts on the dialog itself (tabIndex -1): cycle from there.
      const atEdge = e.shiftKey
        ? current === first || current === root || !root.contains(current)
        : current === last || current === root || !root.contains(current)

      if (!atEdge) return
      e.preventDefault()
      if (e.shiftKey) last.focus()
      else first.focus()
    }

    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      if (saved?.isConnected) saved.focus()
    }
  }, [active])

  return ref
}
