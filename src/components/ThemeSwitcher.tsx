import { useCallback, useEffect, useState } from "react"

import { useI18n } from "../i18n"
import {
  type Theme,
  THEMES,
  applyTheme,
  initialTheme,
  saveTheme,
} from "../lib/theme"

/** One compact toggle: AUTO → LIGHT → DARK, following the OS while on AUTO. */
export default function ThemeSwitcher() {
  const { t } = useI18n()
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    applyTheme(theme)
    if (theme !== "auto") return
    const media = matchMedia("(prefers-color-scheme: dark)")
    const sync = () => applyTheme("auto")
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [theme])

  const cycle = useCallback(() => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
    setTheme(next)
    saveTheme(next)
  }, [theme])

  const themeClass =
    theme === "auto" ? "text-muted opacity-60 hover:opacity-100" : "text-ink"

  return (
    <button
      type="button"
      onClick={cycle}
      title={`${t("theme.label")}: ${t(`theme.${theme}`)}`}
      aria-label={`${t("theme.label")}: ${t(`theme.${theme}`)}`}
      className={`-my-2 py-2 font-mono text-[8px] uppercase tracking-[0.18em] transition-colors sm:text-[9px] ${themeClass}`}
    >
      {t(`theme.${theme}`)}
    </button>
  )
}
