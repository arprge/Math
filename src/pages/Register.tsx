import type {
  EnrichedItem,
  StatusCounts,
  WarrantyItem,
} from "../domain/warranty"
import type { PriceStats, WarrantyRisk } from "../stats"
import { useI18n } from "../i18n"
import type { LoadState } from "../App"
import Stat from "../components/Stat"
import MoneyStat from "../components/MoneyStat"
import StatusDot from "../components/StatusDot"
import ProgressLeft from "../components/ProgressLeft"
import ReceiptCard from "../components/ReceiptCard"
import RegisterSkeleton from "../components/RegisterSkeleton"
import RegisterError from "../components/RegisterError"

export type Filter = "all" | "active" | "soon" | "expired"
export type ViewMode = "list" | "receipts"

/** Register view: stat band, controls, and the list / receipt grid. */
export default function RegisterPage({
  items,
  ready,
  load,
  counts,
  covered,
  priceStats,
  visible,
  riskByItemId,
  printed,
  filter,
  setFilter,
  viewMode,
  setViewMode,
  onRegister,
  onPrepare,
  onRetry,
}: {
  items: WarrantyItem[]
  ready: boolean
  load: LoadState
  counts: StatusCounts
  covered: number
  priceStats: PriceStats
  visible: EnrichedItem[]
  riskByItemId: Map<string, WarrantyRisk>
  printed: WarrantyItem | null
  filter: Filter
  setFilter: (f: Filter) => void
  viewMode: ViewMode
  setViewMode: (v: ViewMode) => void
  onRegister: () => void
  onPrepare: () => void
  onRetry: () => void
}) {
  const { t, fmt } = useI18n()

  return (
    <main className="mx-auto max-w-6xl px-6 pt-8 pb-6 sm:pt-6">
      {/* Stat band — tighter padding */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border border-line mb-8 bg-receipt soft-raised">
        <Stat
          label={t("stats.total")}
          value={String(items.length)}
          pending={!ready}
        />
        <Stat
          label={t("stats.active")}
          value={String(counts.active)}
          accent="ok"
          pending={!ready}
        />
        <Stat
          label={t("stats.soon")}
          value={String(counts.soon)}
          accent="warn"
          pending={!ready}
        />
        {ready ? (
          <MoneyStat
            value={fmt.money(covered)}
            stats={priceStats}
          />
        ) : (
          <Stat label={t("stats.value")} value="" accent="signal" pending />
        )}
      </section>

      {/* Controls bar — filters, view selector, and Register form one
          right-anchored horizontal block. The view + Register group stays
          together, separated from the filters by only a tiny margin.
          Horizontal insets nudge everything toward center for two-handed reach. */}
      <div className="mb-5 pl-[9px] pr-[22px] sm:px-0 flex flex-wrap items-center justify-end gap-[9px]">
        {/* Filter segmented control — one compact row, with labels and counts
            kept intact at every viewport. */}
        <div className="grid w-full grid-cols-4 gap-px bg-line p-px sm:inline-grid sm:w-auto">
          {(["all", "active", "soon", "expired"] as Filter[]).map((f) => {
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                disabled={!ready}
                aria-pressed={active}
                className={`flex w-full min-w-0 items-center justify-center gap-0.5 whitespace-nowrap px-1 py-1 font-mono uppercase sm:w-auto sm:min-w-[104px] sm:gap-1.5 sm:px-3 ${
                  active
                    ? "bg-ink text-paper soft-pressed"
                    : "bg-receipt text-muted soft-key hover:text-ink"
                }`}
              >
                <span className="whitespace-nowrap text-[9px] tracking-[0.04em] sm:text-[10px] sm:tracking-[0.15em]">
                  {t(`filter.${f}`)}
                </span>
                <span
                  className={`text-[10px] tabular-nums ${
                    active ? "opacity-60" : "opacity-45"
                  }`}
                >
                  {ready ? counts[f] : "–"}
                </span>
              </button>
            )
          })}
        </div>

        {/* View selector + Register — grouped, tiny margin from the filters */}
        <div className="mt-1 ml-[9px] flex items-center gap-x-[3px] gap-y-[9px]">
          <div className="flex border border-line">
            <button
              onClick={() => setViewMode("list")}
              title={t("controls.listView")}
              className={`font-mono text-[10px] uppercase tracking-[0.12em] px-3 py-1.5 transition-all ${
                viewMode === "list"
                  ? "bg-ink text-paper soft-pressed"
                  : "bg-receipt text-muted soft-key hover:text-ink"
              }`}
            >
              {t("controls.list")}
            </button>
            <button
              onClick={() => setViewMode("receipts")}
              title={t("controls.receiptView")}
              className={`font-mono text-[10px] uppercase tracking-[0.12em] px-3 py-1.5 border-l border-line transition-all ${
                viewMode === "receipts"
                  ? "bg-ink text-paper soft-pressed"
                  : "bg-receipt text-muted soft-key hover:text-ink"
              }`}
            >
              {t("controls.receipt")}
            </button>
          </div>

          <button
            onClick={onRegister}
            onPointerEnter={onPrepare}
            onFocus={onPrepare}
            disabled={!ready}
            className="font-mono text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 bg-signal text-white hover:bg-ink hover:text-paper transition-colors whitespace-nowrap disabled:opacity-40 disabled:hover:bg-signal disabled:hover:text-white"
          >
            + <span className="hidden sm:inline">{t("controls.register")}</span>
            <span className="sm:hidden">{t("controls.add")}</span>
          </button>
        </div>
      </div>

      {load.status === "error" && (
        <RegisterError message={fmt.error(load.error)} onRetry={onRetry} />
      )}

      {load.status === "loading" && <RegisterSkeleton viewMode={viewMode} />}

      {/* List view */}
      {ready && viewMode === "list" && (
        <div className="border border-line bg-receipt soft-raised">
          <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-6 px-4 py-2 border-b border-line font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            <span>{t("list.product")}</span>
            <span className="text-right w-28">{t("list.purchased")}</span>
            <span className="text-right w-28">{t("list.expires")}</span>
            <span className="text-right w-40">{t("list.timeLeft")}</span>
          </div>
          <ul>
            {visible.map(({ it, days, status, expiry }) => (
              <li
                key={it.id}
                className={`group grid md:grid-cols-[1fr_auto_auto_auto] gap-2 md:gap-6 items-center px-4 py-3.5 border-b border-line last:border-b-0 hover:bg-lift transition-colors ${
                  printed?.id === it.id ? "print-in" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusDot status={status} />
                    <span className="font-display font-bold text-base leading-tight truncate">
                      {it.product}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted mt-0.5 truncate">
                    {it.brand} · {fmt.category(it.category)} · {it.serial}
                    {!it.receipt && (
                      <span className="text-signal"> · {t("list.noReceipt")}</span>
                    )}
                  </div>
                </div>
                <div className="font-mono text-xs text-muted md:text-right md:w-28">
                  {fmt.date(new Date(it.purchaseDate))}
                </div>
                <div className="font-mono text-xs text-muted md:text-right md:w-28">
                  {fmt.date(expiry)}
                </div>
                <div className="md:w-40 md:text-right">
                  <ProgressLeft item={it} days={days} status={status} />
                </div>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="px-4 py-16 text-center font-mono text-xs text-muted">
                {t("list.empty")}
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Receipt grid view */}
      {ready && viewMode === "receipts" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {visible.map(({ it, days, status, expiry }) => (
            <ReceiptCard
              key={it.id}
              it={it}
              days={days}
              status={status}
              expiry={expiry}
              risk={riskByItemId.get(it.id)}
              fresh={printed?.id === it.id}
            />
          ))}
          {visible.length === 0 && (
            <div className="col-span-full py-16 text-center font-mono text-xs text-muted">
              {t("list.empty")}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
