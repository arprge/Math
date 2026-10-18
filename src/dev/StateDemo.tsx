// Self-contained state demo. To remove: delete src/dev/ and the two lines
// marked "DEMO" in src/App.tsx.
import { useEffect, useRef, useState } from "react"

import { faultSource, type Fault } from "../domain/repo"

type Mode = "off" | "loading" | "load-error" | "save-error"

const FAULTS: Record<Mode, Fault> = {
  off: {},
  loading: { loadDelayMs: 4000 },
  "load-error": { fail: "load" },
  "save-error": { fail: "save" },
}

const OPTIONS: { mode: Mode; label: string; hint: string }[] = [
  { mode: "off", label: "Normal", hint: "no injected faults" },
  { mode: "loading", label: "Loading", hint: "4s skeleton hold" },
  { mode: "load-error", label: "Load error", hint: "register fails to read" },
  { mode: "save-error", label: "Save error", hint: "next filing fails" },
]

export default function StateDemo({ onReload }: { onReload: () => void }) {
  const [mode, setMode] = useState<Mode>("off")
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    faultSource.current = () => FAULTS[mode]
    return () => {
      faultSource.current = null
    }
  }, [mode])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const pick = (next: Mode) => {
    faultSource.current = () => FAULTS[next]
    setMode(next)
    setOpen(false)
    if (next !== "save-error") onReload()
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`border border-dashed px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] transition-colors sm:text-[10px] ${
          mode === "off"
            ? "border-muted/60 text-muted hover:border-ink hover:text-ink"
            : "border-ink bg-ink text-paper"
        }`}
      >
        Demo{mode !== "off" ? ` · ${mode.replace("-", " ")}` : ""}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 border border-ink bg-paper p-1 text-left shadow-[3px_3px_0_0_currentColor]"
        >
          {OPTIONS.map((o) => (
            <button
              key={o.mode}
              role="menuitemradio"
              aria-checked={mode === o.mode}
              onClick={() => pick(o.mode)}
              className="flex w-full items-baseline justify-between gap-3 px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink hover:bg-ink hover:text-paper"
            >
              <span>
                {mode === o.mode ? "▸ " : ""}
                {o.label}
              </span>
              <span className="text-[8px] normal-case tracking-normal opacity-60">
                {o.hint}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
