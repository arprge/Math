import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "preact/compat"

import en, { type Dict, type Plural } from "./dict/en"
import ru from "./dict/ru"
import kk from "./dict/kk"
import { fmtDate, humanLeft, money, warrantyLength } from "../lib/format"
import { RepoError } from "../domain/repo"

export type Lang = "en" | "ru" | "kk"

export const LANGS: { code: Lang; label: string; name: string }[] = [
  { code: "en", label: "EN", name: "English" },
  { code: "ru", label: "RU", name: "Русский" },
  { code: "kk", label: "KZ", name: "Қазақша" },
]

export const LOCALE: Record<Lang, string> = { en: "en-GB", ru: "ru-RU", kk: "kk-KZ" }

const DICTS: Record<Lang, Dict> = { en, ru, kk }
const STORAGE_KEY = "warranty-keeper:lang"

type Leaf = string | Plural
/** Every dotted key that resolves to a string or plural value. */
export type Key<T = Dict> = {
  [K in keyof T & string]: T[K] extends Leaf
  ? K
  : T[K] extends readonly string[]
  ? never
  : `${K}.${Key<T[K]>}`
}[keyof T & string]

type Vars = Record<string, string | number>

const isLang = (v: unknown): v is Lang => v === "en" || v === "ru" || v === "kk"

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLang(saved)) return saved
  } catch {
    // Storage blocked: fall through to detection.
  }
  const nav = typeof navigator === "undefined" ? "" : navigator.language.toLowerCase()
  if (nav.startsWith("ru")) return "ru"
  if (nav.startsWith("kk")) return "kk"
  return "en"
}

function lookup(dict: Dict, key: string): Leaf | undefined {
  let node: unknown = dict
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === "string" || (node && typeof node === "object") ? (node as Leaf) : undefined
}

const interpolate = (s: string, vars?: Vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m)) : s

function makeI18n(lang: Lang) {
  const dict = DICTS[lang]
  const locale = LOCALE[lang]
  const rules = new Intl.PluralRules(locale)

  const t = (key: Key, vars?: Vars): string => {
    const value = lookup(dict, key) ?? lookup(en, key) ?? key
    if (typeof value === "string") return interpolate(value, vars)
    const count = typeof vars?.count === "number" ? vars.count : 0
    const form = rules.select(count) as keyof Plural
    return interpolate(value[form] ?? value.other, vars)
  }

  const fmt = {
    // en keeps Intl's en-GB output; ru/kk build "10 сен 2026" from the dictionary
    // so engines with partial kk data (or "г."/"ж." suffixes) stay consistent.
    date: (d: Date) => fmtDate(d, lang === "en" ? locale : null, dict.monthsShort),
    money: (n: number) => money(n, locale),
    left: (days: number) => humanLeft(days, dict.units),
    warranty: (months: number) => warrantyLength(months, dict.units),
    number: (n: number, digits = 0) =>
      n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    category: (value: string) => (dict.category as Record<string, string>)[value] ?? value,
    /** Month name for a `YYYY-MM` key. */
    month: (key: string) => dict.months[Number(key.slice(5)) - 1] ?? key,
    upper: (s: string) => s.toLocaleUpperCase(locale),
    /** Map a thrown error to a user-facing sentence (never the raw message). */
    error: (e: unknown) =>
      e instanceof RepoError
        ? t(e.code === "LOAD_FAILED" ? "errors.load" : "errors.save")
        : t("errors.generic"),
  }

  return { lang, t, fmt, dict }
}

type I18n = ReturnType<typeof makeI18n> & { setLang: (l: Lang) => void }

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Keep the choice in memory only.
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => ({ ...makeI18n(lang), setLang }), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>")
  return ctx
}
