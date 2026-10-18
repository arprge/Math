import { TODAY } from "../domain/warranty"
import { useI18n } from "../i18n"

/** Colophon rule with the record count. */
export default function Footer({
  ready,
  count,
}: {
  ready: boolean
  count: number
}) {
  const { t, fmt } = useI18n()
  return (
    <footer className="mx-auto max-w-6xl px-4 py-5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:px-6 sm:py-8 sm:text-[10px] sm:tracking-[0.2em]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:flex sm:gap-4">
        <span className="whitespace-nowrap" lang="en">Warranty Keeper</span>
        <div className="flex items-center justify-end gap-3 sm:contents">
          <span className="hidden opacity-50 sm:inline">·</span>
          <span className="opacity-60">{fmt.date(TODAY)}</span>
        </div>
        <span className="col-span-2 border-t border-line pt-2 text-right opacity-40 sm:col-auto sm:ml-auto sm:border-0 sm:pt-0">
          {ready ? t("footer.records", { count }) : t("footer.pending")}
        </span>
      </div>
    </footer>
  )
}
