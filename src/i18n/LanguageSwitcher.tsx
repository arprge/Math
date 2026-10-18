import { LANGS, useI18n } from "."

/** A quiet EN · RU · KZ toggle that reads like the header's nav type. */
export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()
  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className="group/lang flex items-center gap-1.5 font-mono text-[8px] uppercase leading-none tracking-[0.18em] sm:text-[9px]"
    >
      {LANGS.map((l, i) => {
        const active = l.code === lang
        return (
          <span key={l.code} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-muted opacity-50">
                ·
              </span>
            )}
            <button
              type="button"
              lang={l.code}
              aria-label={l.name}
              aria-pressed={active}
              onClick={() => setLang(l.code)}
              className={`-my-2 py-2 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                active
                  ? "text-ink"
                  : "text-muted opacity-40 hover:opacity-100 group-hover/lang:opacity-80 group-focus-within/lang:opacity-80"
              }`}
            >
              {l.label}
            </button>
          </span>
        )
      })}
    </div>
  )
}
