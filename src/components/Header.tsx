import { TODAY } from "../domain/warranty"
import { useI18n } from "../i18n"
import LanguageSwitcher from "../i18n/LanguageSwitcher"
import ThemeSwitcher from "./ThemeSwitcher"
import StateDemo from "../dev/StateDemo" // DEMO: remove with src/dev

export type Page = "register" | "archive"

export type Meta = { key: string; text: string; tone: string }

/** Masthead: wordmark, page nav, language switcher, date and file status. */
export default function Header({
  page,
  setPage,
  onPrepareArchive,
  onReload,
  meta,
}: {
  page: Page
  setPage: (p: Page) => void
  onPrepareArchive: () => void
  onReload: () => void
  meta: Meta
}) {
  const { t, fmt } = useI18n()
  return (
    <header className="border-b border-line/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-6 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[19px] font-extrabold leading-none tracking-tight sm:text-[22px]">
              WARRANTY KEEPER
            </h1>
            <nav className="mt-1.5 flex items-center gap-2 font-mono text-[8px] uppercase leading-none tracking-[0.22em] sm:text-[9px]">
              {(["register", "archive"] as Page[]).map((p, i) => (
                <span key={p} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted opacity-50">·</span>}
                  <button
                    onClick={() => setPage(p)}
                    onPointerEnter={p === "archive" ? onPrepareArchive : undefined}
                    onFocus={p === "archive" ? onPrepareArchive : undefined}
                    aria-current={page === p ? "page" : undefined}
                    className={`border-b pb-0.5 transition-colors ${page === p
                        ? "border-ink text-ink"
                        : "border-transparent text-muted hover:text-ink"
                      }`}
                  >
                    {t(`nav.${p}`)}
                  </button>
                </span>
              ))}
            </nav>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <StateDemo onReload={onReload} /> {/* DEMO */}
          <div className="shrink-0 text-right font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-muted sm:text-[10px] sm:tracking-[0.18em]">
            <div className="flex items-center justify-end gap-3 text-muted sm:gap-4">
              <ThemeSwitcher />
              <LanguageSwitcher />
              <span>{fmt.date(TODAY)}</span>
            </div>
            <div
              key={meta.key}
              role="status"
              aria-live="polite"
              className={`meta-in ${meta.tone}`}
            >
              {meta.text}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
