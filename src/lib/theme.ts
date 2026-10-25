export type Theme = "auto" | "light" | "dark"

export const THEMES: Theme[] = ["auto", "light", "dark"]
export const THEME_KEY = "warranty-keeper:theme"

const isTheme = (v: unknown): v is Theme => v === "auto" || v === "light" || v === "dark"

export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (isTheme(saved)) return saved
  } catch {
    // Storage blocked: fall through to auto.
  }
  return "auto"
}

/** Resolve auto against the OS and stamp the result on <html>. */
export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.dataset.theme = dark ? "dark" : "light"
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Keep the choice in memory only.
  }
}
