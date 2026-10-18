import { useMemo, useState } from "react"

import {
  type WarrantyItem,
  TODAY,
  expiryDate,
  enrichItems,
  countByStatus,
  coveredValue,
} from "./domain/warranty"
import { SEED } from "./domain/seed"
import { gbp, fmtDate, humanLeft } from "./lib/format"
import {
  buildStatContext,
  priceCoverStat,
  warrantyRiskStat,
  type PriceStats,
  type WarrantyRisk,
  monthlyRiskStat,
  type MonthlyRiskStats,
} from "./stats"

function barcodesFrom(serial: string): number[] {
  const bars: number[] = []
  for (let i = 0; i < 44; i++) {
    const c = serial.charCodeAt(i % serial.length)
    bars.push(((c ^ (i * 17)) % 3) + 1)
  }
  return bars
}

type Filter = "all" | "active" | "soon" | "expired"
type ViewMode = "list" | "receipts"

export default function App() {
  const [items, setItems] = useState<WarrantyItem[]>(SEED)
  const [filter, setFilter] = useState<Filter>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("receipts")
  const [adding, setAdding] = useState(false)

  const enriched = useMemo(() => enrichItems(items), [items])
  const counts = useMemo(() => countByStatus(enriched), [enriched])
  const covered = useMemo(() => coveredValue(enriched), [enriched])

  const statCtx = useMemo(() => buildStatContext(enriched), [enriched])
  const priceStats = useMemo(() => priceCoverStat.compute(statCtx), [statCtx])
  const risks = useMemo(() => warrantyRiskStat.compute(statCtx), [statCtx])
  const monthlyRisk = useMemo(
    () => monthlyRiskStat.compute(statCtx),
    [statCtx],
  )
  const riskByItemId = useMemo(
    () => new Map(risks.map((risk) => [risk.item.id, risk])),
    [risks],
  )

  const visible =
    filter === "all" ? enriched : enriched.filter((e) => e.status === filter)

  return (
    <div className="min-h-full font-body text-ink">
      {/* Header — compact two-col rule */}
      <header className="border-b border-line/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-6 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-[19px] font-extrabold leading-none tracking-tight sm:text-[22px]">
                WARRANTY KEEPER
              </h1>
              <span className="mt-1.5 inline-block font-mono text-[8px] uppercase leading-none tracking-[0.22em] text-muted sm:text-[9px]">
                Product Register
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-muted sm:text-[10px] sm:tracking-[0.18em]">
            <div className="text-muted">{fmtDate(TODAY)}</div>
            <div className="opacity-55">{items.length} records on file</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-8 pb-6 sm:pt-6">
        {/* Stat band — tighter padding */}
        <section className="grid grid-cols-2 lg:grid-cols-4 border border-line mb-8 bg-receipt shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_1px_0_rgba(27,42,56,0.08),0_4px_9px_rgba(27,42,56,0.035)]">
          <Stat label="Total items" value={String(items.length)} />
          <Stat
            label="Active cover"
            value={String(counts.active)}
            accent="ok"
          />
          <Stat
            label="Expiring ≤ 60d"
            value={String(counts.soon)}
            accent="warn"
          />
          <MoneyStat
            value={`£${covered.toLocaleString()}`}
            stats={priceStats}
          />
        </section>

        <MonthlyRiskBand stats={monthlyRisk} />

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
                  aria-pressed={active}
                  className={`flex w-full min-w-0 items-center justify-center gap-0.5 whitespace-nowrap px-1 py-1 font-mono uppercase transition-all sm:w-[104px] sm:gap-1.5 sm:px-3 ${active
                    ? "bg-ink text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    : "bg-receipt text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] hover:text-ink hover:bg-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_4px_rgba(27,42,56,0.05)] active:shadow-[inset_0_1px_2px_rgba(27,42,56,0.08)]"
                    }`}
                >
                  <span className="whitespace-nowrap text-[9px] tracking-[0.04em] sm:text-[10px] sm:tracking-[0.15em]">
                    {f}
                  </span>
                  <span
                    className={`text-[10px] tabular-nums ${active ? "opacity-60" : "opacity-45"
                      }`}
                  >
                    {counts[f]}
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
                title="List view"
                className={`font-mono text-[10px] uppercase tracking-[0.12em] px-3 py-1.5 transition-all ${viewMode === "list"
                  ? "bg-ink text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  : "bg-receipt text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] hover:text-ink hover:bg-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_4px_rgba(27,42,56,0.05)] active:shadow-[inset_0_1px_2px_rgba(27,42,56,0.08)]"
                  }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("receipts")}
                title="Receipt view"
                className={`font-mono text-[10px] uppercase tracking-[0.12em] px-3 py-1.5 border-l border-line transition-all ${viewMode === "receipts"
                  ? "bg-ink text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  : "bg-receipt text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] hover:text-ink hover:bg-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_4px_rgba(27,42,56,0.05)] active:shadow-[inset_0_1px_2px_rgba(27,42,56,0.08)]"
                  }`}
              >
                Receipt
              </button>
            </div>

            <button
              onClick={() => setAdding(true)}
              className="font-mono text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 bg-signal text-white hover:bg-ink transition-colors whitespace-nowrap"
            >
              + <span className="hidden sm:inline">Register item</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* List view */}
        {viewMode === "list" && (
          <div className="border border-line bg-receipt shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_1px_0_rgba(27,42,56,0.08),0_4px_9px_rgba(27,42,56,0.035)]">
            <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-6 px-4 py-2 border-b border-line font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              <span>Product</span>
              <span className="text-right w-28">Purchased</span>
              <span className="text-right w-28">Expires</span>
              <span className="text-right w-40">Time left</span>
            </div>
            <ul>
              {visible.map(({ it, days, status, expiry }) => (
                <li
                  key={it.id}
                  className="group grid md:grid-cols-[1fr_auto_auto_auto] gap-2 md:gap-6 items-center px-4 py-3.5 border-b border-line last:border-b-0 hover:bg-white transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusDot status={status} />
                      <span className="font-display font-bold text-base leading-tight truncate">
                        {it.product}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-muted mt-0.5 truncate">
                      {it.brand} · {it.category} · {it.serial}
                      {!it.receipt && (
                        <span className="text-signal"> · no receipt</span>
                      )}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-muted md:text-right md:w-28">
                    {fmtDate(new Date(it.purchaseDate))}
                  </div>
                  <div className="font-mono text-xs text-muted md:text-right md:w-28">
                    {fmtDate(expiry)}
                  </div>
                  <div className="md:w-40 md:text-right">
                    <ProgressLeft item={it} days={days} status={status} />
                  </div>
                </li>
              ))}
              {visible.length === 0 && (
                <li className="px-4 py-16 text-center font-mono text-xs text-muted">
                  No items in this view.
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Receipt grid view */}
        {viewMode === "receipts" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visible.map(({ it, days, status, expiry }) => (
              <ReceiptCard
                key={it.id}
                it={it}
                days={days}
                status={status}
                expiry={expiry}
                risk={riskByItemId.get(it.id)}
              />
            ))}
            {visible.length === 0 && (
              <div className="col-span-full py-16 text-center font-mono text-xs text-muted">
                No items in this view.
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:px-6 sm:py-8 sm:text-[10px] sm:tracking-[0.2em]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:flex sm:gap-4">
          <span className="whitespace-nowrap">Warranty Keeper</span>
          <div className="flex items-center justify-end gap-3 sm:contents">
            <span className="hidden opacity-50 sm:inline">·</span>
            <span className="opacity-60">{fmtDate(TODAY)}</span>
          </div>
          <span className="col-span-2 border-t border-line pt-2 text-right opacity-40 sm:col-auto sm:ml-auto sm:border-0 sm:pt-0">
            {items.length} records
          </span>
        </div>
      </footer>

      {adding && (
        <AddDialog
          onClose={() => setAdding(false)}
          onAdd={(it) => setItems((s) => [...s, it])}
        />
      )}
    </div>
  )
}

function MonthlyRiskBand({ stats }: { stats: MonthlyRiskStats }) {
  return (
    <section className="mb-8 border border-line bg-paper px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Monthly breakdown model · Poisson + Binomial
        </h2>
        <span className="font-mono text-[10px] text-muted">
          n={stats.items} covered items
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <RiskMetric label="P(at least 1)" value={`${Math.round(stats.poissonAtLeastOne * 100)}%`} />
        <RiskMetric label="Binomial check" value={`${Math.round(stats.binomialAtLeastOne * 100)}%`} />
        <RiskMetric label="Expected events" value={stats.expectedBreakdowns.toFixed(2)} />
        <RiskMetric label="Expected cost" value={`£${Math.round(stats.expectedCost)}`} />
        <RiskMetric label="95% reserve" value={`£${Math.round(stats.reserveCost)}`} accent />
      </div>
      <p className="mt-3 max-w-3xl font-mono text-[10px] leading-relaxed text-muted">
        Poisson: λ = sum of monthly probabilities. Binomial cross-check: P(at least one) = 1 − (1 − p̄)^n.
      </p>
    </section>
  )
}

function RiskMetric({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted">
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl font-extrabold ${accent ? "text-signal" : "text-ink"}`}>
        {value}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: "ok" | "warn" | "signal"
}) {
  const color =
    accent === "ok"
      ? "text-ok"
      : accent === "warn"
        ? "text-warn"
        : accent === "signal"
          ? "text-signal"
          : "text-ink"
  return (
    <div className="border-r border-b border-line px-5 py-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {label}
      </div>
      <div
        className={`font-display font-extrabold text-3xl leading-none mt-3 tracking-tight ${color}`}
      >
        {value}
      </div>
    </div>
  )
}

function MoneyStat({ value, stats }: { value: string stats: PriceStats }) {
  const [open, setOpen] = useState(false)
  const highRisk = stats.p >= 0.5

  return (
    <div className="relative border-r border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group w-full px-5 py-6 text-left transition-colors hover:bg-white"
      >
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Value covered
          </span>
          <span
            className={`inline-block font-mono text-[9px] leading-none text-muted opacity-40 transition-all group-hover:opacity-90 ${open ? "rotate-180" : "rotate-90"
              }`}
          >
            &gt;
          </span>
        </div>
        <div className="mt-3 font-display text-3xl font-extrabold leading-none tracking-tight text-signal">
          {value}
        </div>
      </button>

      {open && (
        <>
          {/* click-away catcher */}
          <button
            type="button"
            aria-label="Close breakdown"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          {/* popover — thermal-ticket voice, anchored near the value */}
          <div
            role="dialog"
            aria-label="Value covered breakdown"
            className="absolute right-3 top-[calc(100%-6px)] z-50 w-[min(320px,calc(100vw-2rem))] origin-top-right animate-[moneyPop_120ms_ease-out] border-t border-x border-ink bg-paper shadow-[2px_3px_0_rgba(27,42,56,0.08),0_8px_18px_rgba(27,42,56,0.05)]"
          >
            {/* caret */}
            <div className="absolute -top-[5px] right-6 h-2.5 w-2.5 rotate-45 border-l border-t border-ink bg-paper" />

            {/* signal header rule */}
            <div className="h-[3px] w-full bg-signal" />

            <div className="px-4 pb-4 pt-3">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink">
                  Cover breakdown
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted">
                  n={stats.n}
                </span>
              </div>

              <dl className="space-y-2 font-mono text-[11px]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">Median item</dt>
                  <dd className="font-bold tabular-nums text-ink">
                    {gbp(stats.median)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">Core range · 50%</dt>
                  <dd className="tabular-nums text-ink">
                    {gbp(stats.q1)} – {gbp(stats.q3)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="pl-3 text-[10px] text-muted opacity-70">
                    IQR spread
                  </dt>
                  <dd className="tabular-nums text-muted">{gbp(stats.iqr)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">Price outliers</dt>
                  <dd className="tabular-nums text-ink">
                    {stats.outliers.length === 0 ? (
                      <span className="text-ok">None</span>
                    ) : (
                      <span className="text-signal">
                        {stats.outliers.length} above {gbp(stats.fence)}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="receipt-dash my-3" />

              {/* Cash-gap risk — the urgency line */}
              <div className="flex items-start gap-2">
                <span
                  className={`mt-[3px] h-2 w-2 shrink-0 ${highRisk ? "bg-signal" : "bg-ok"
                    }`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <div
                    className={`font-mono text-[11px] font-bold leading-snug ${highRisk ? "text-signal" : "text-ink"
                      }`}
                  >
                    Cash-gap risk · {Math.round(stats.p * 100)}%
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] leading-snug text-muted">
                    {stats.soon}/{stats.n} items expire soon. Group-expiry
                    probability P={stats.p.toFixed(2)}.
                  </div>
                </div>
              </div>
            </div>

            {/* An uneven hand-torn edge — intentionally irregular rather than a repeating zigzag. */}
            <div
              className="relative -mb-[27px] block h-[28px] w-full"
              aria-hidden="true"
            >
              <svg
                className="block h-[28px] w-full overflow-visible"
                viewBox="0 0 320 30"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 0H320V13L306 14L294 18L281 16L266 22L251 19L237 26L221 22L207 28L190 24L174 26L158 20L141 27L123 23L106 28L89 22L73 25L57 19L42 24L26 17L11 20L0 14Z"
                  fill="var(--color-paper)"
                />
                <path
                  d="M0 0V14L11 20L26 17L42 24L57 19L73 25L89 22L106 28L123 23L141 27L158 20L174 26L190 24L207 28L221 22L237 26L251 19L266 22L281 16L294 18L306 14L320 13V0"
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M42 24l2.1 3.2M104 27l1.7 2.2M173 25l2.4 3.1M235 25l1.9 2.5"
                  stroke="var(--color-ink)"
                  strokeOpacity=".28"
                  strokeWidth=".7"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: "expired" | "soon" | "active" }) {
  const c =
    status === "expired" ? "bg-signal" : status === "soon" ? "bg-warn" : "bg-ok"
  return <span className={`inline-block w-2 h-2 shrink-0 ${c}`} aria-hidden />
}

function ProgressLeft({
  item,
  days,
  status,
}: {
  item: WarrantyItem
  days: number
  status: "expired" | "soon" | "active"
}) {
  const totalDays = item.warrantyMonths * 30.4
  const pct = Math.max(0, Math.min(100, (days / totalDays) * 100))
  const bar =
    status === "expired" ? "bg-signal" : status === "soon" ? "bg-warn" : "bg-ok"
  const label =
    status === "expired"
      ? "text-signal"
      : status === "soon"
        ? "text-warn"
        : "text-ink"
  return (
    <div className="flex items-center gap-3 md:justify-end">
      <div className="h-1.5 w-24 bg-line/70 overflow-hidden md:order-2">
        <div
          className={`h-full ${bar}`}
          style={{ width: `${status === "expired" ? 100 : pct}%` }}
        />
      </div>
      <span
        className={`font-mono text-sm font-bold tabular-nums md:order-1 ${label}`}
      >
        {status === "expired" ? "EXPIRED" : humanLeft(days)}
      </span>
    </div>
  )
}

function ReceiptCard({
  it,
  days,
  status,
  expiry,
  risk,
}: {
  it: WarrantyItem
  days: number
  status: "expired" | "soon" | "active"
  expiry: Date
  risk?: WarrantyRisk
}) {
  const totalDays = it.warrantyMonths * 30.4
  const pct = Math.max(0, Math.min(100, (days / totalDays) * 100))
  const barColor =
    status === "expired" ? "bg-signal" : status === "soon" ? "bg-warn" : "bg-ok"
  const timeColor =
    status === "expired"
      ? "text-signal"
      : status === "soon"
        ? "text-warn"
        : "text-ink"
  const bars = barcodesFrom(it.serial)

  return (
    <div
      className="receipt-card relative group"
      style={{ background: "var(--color-receipt)" }}
    >
      {/* Top perforation strip */}
      <div className="receipt-perf-top" />

      {/* Receipt body */}
      <div className="flex flex-1 flex-col px-5 pt-4 pb-4">
        {/* Letterhead row */}
        <div className="flex items-center justify-between mb-1">
          <StatusDot status={status} />
        </div>
        <div className="font-mono text-[10px] text-muted mb-3 truncate">
          {it.store}
        </div>

        <div className="receipt-dash mb-3" />

        {/* Product name — display font as the single designed element */}
        <div className="receipt-product font-display font-extrabold text-xl leading-tight mb-1">
          {it.product}
        </div>
        <div className="font-mono text-[10px] text-muted mb-3">
          {it.brand} · {it.category}
        </div>

        {/* Time remaining — hero stat */}
        <div
          className={`font-mono font-bold text-3xl tracking-tight leading-none mb-2 ${timeColor}`}
        >
          {status === "expired" ? "EXPIRED" : humanLeft(days)}
        </div>
        {/* Draining bar */}
        <div className="h-1.5 bg-line/40 mb-3 overflow-hidden">
          <div
            className={`h-full ${barColor}`}
            style={{ width: `${status === "expired" ? 100 : pct}%` }}
          />
        </div>

        <div className="receipt-dash mb-3" />

        {/* Key data rows */}
        <div className="font-mono text-[10px] space-y-1.5 mb-3">
          <div className="flex justify-between gap-3">
            <span className="text-muted">PURCHASED</span>
            <span>{fmtDate(new Date(it.purchaseDate))}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">EXPIRES</span>
            <span>{fmtDate(expiry)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">WARRANTY</span>
            <span>
              {it.warrantyMonths >= 12
                ? `${it.warrantyMonths / 12}yr`
                : `${it.warrantyMonths}mo`}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">VALUE</span>
            <span>£{it.price.toLocaleString()}</span>
          </div>
        </div>

        {risk && <RiskFlag risk={risk} />}

        <div className="mt-auto">
          <div className="font-mono text-[9px] text-muted truncate mb-1.5">
            SN/{it.serial}
          </div>

          {it.receipt ? (
            <div className="font-mono text-[9px] text-ok mb-3">
              ✓ RECEIPT ON FILE
            </div>
          ) : (
            <div className="font-mono text-[9px] text-signal mb-3">
              ✗ NO RECEIPT
            </div>
          )}

          {/* Barcode */}
          <div
            className="flex items-end h-8 overflow-hidden"
            style={{ gap: "1.5px" }}
            aria-hidden
          >
            {bars.map((w, i) => (
              <div
                key={i}
                className="bg-ink shrink-0"
                style={{ width: w, height: `${44 + ((i * 31) % 5) * 11}%` }}
              />
            ))}
          </div>
          <div className="font-mono text-[7px] text-center text-muted mt-1 tracking-widest">
            {it.serial
              .replace(/[^0-9]/g, "")
              .padEnd(13, "0")
              .slice(0, 13)}
          </div>
        </div>
      </div>

      {/* Bottom perforation strip */}
      <div className="receipt-perf-bottom" />
    </div>
  )
}

function RiskFlag({ risk }: { risk: WarrantyRisk }) {
  const tone =
    risk.level === "high" || risk.level === "expired"
      ? "bg-signal text-white"
      : risk.level === "watch"
        ? "bg-warn text-ink"
        : "bg-ok text-white"
  const label =
    risk.level === "high"
      ? "SERVICE PRIORITY"
      : risk.level === "watch"
        ? "SERVICE WINDOW"
        : risk.level === "expired"
          ? "COVER CLOSED"
          : "SERVICE STATUS"

  return (
    <div className="mb-3 border-t border-line pt-3">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 h-2 w-2 shrink-0 ${tone}`} aria-hidden />
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
            {label}
          </div>
          <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-h-16 group-hover:opacity-100 group-focus-within:max-h-16 group-focus-within:opacity-100">
            <p className="mt-0.5 font-mono text-[10px] leading-snug text-muted">
              {risk.recommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (it: WarrantyItem) => void
}) {
  const [form, setForm] = useState({
    product: "",
    brand: "",
    category: "Electronics",
    serial: "",
    store: "",
    purchaseDate: "2026-09-01",
    warrantyMonths: 12,
    price: 0,
    receipt: true,
  })

  const set = (k: string, v: string | number | boolean) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.product.trim()) return
    onAdd({ ...form, id: crypto.randomUUID() })
    onClose()
  }

  const field =
    "w-full bg-paper border border-line px-3 py-2 font-body text-sm focus:outline-none focus:border-ink transition-colors"
  const lbl =
    "font-mono text-[10px] uppercase tracking-[0.2em] text-muted mb-1 block"

  return (
    <div
      className="fixed inset-0 bg-ink/40 flex items-start md:items-center justify-center p-4 overflow-auto"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-ink w-full max-w-lg p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-display font-extrabold text-2xl tracking-tight">
            Register item
          </h2>
          <button
            onClick={onClose}
            className="font-mono text-xs text-muted hover:text-ink"
          >
            ESC ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={lbl}>Product</label>
            <input
              autoFocus
              className={field}
              value={form.product}
              onChange={(e) => set("product", e.target.value)}
              placeholder={'e.g. LG OLED C4 55"'}
            />
          </div>
          <div>
            <label className={lbl}>Brand</label>
            <input
              className={field}
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
            />
          </div>
          <div>
            <label className={lbl}>Category</label>
            <select
              className={field}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {[
                "Electronics",
                "Appliance",
                "Wearable",
                "Furniture",
                "Vehicle",
                "Other",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>Serial / model no.</label>
            <input
              className={field}
              value={form.serial}
              onChange={(e) => set("serial", e.target.value)}
            />
          </div>
          <div>
            <label className={lbl}>Purchase date</label>
            <input
              type="date"
              className={field}
              value={form.purchaseDate}
              onChange={(e) => set("purchaseDate", e.target.value)}
            />
          </div>
          <div>
            <label className={lbl}>Warranty (months)</label>
            <input
              type="number"
              min={1}
              className={field}
              value={form.warrantyMonths}
              onChange={(e) => set("warrantyMonths", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={lbl}>Price (£)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.price}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={lbl}>Store</label>
            <input
              className={field}
              value={form.store}
              onChange={(e) => set("store", e.target.value)}
            />
          </div>
          <label className="col-span-2 flex items-center gap-2 font-mono text-xs text-muted cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={form.receipt}
              onChange={(e) => set("receipt", e.target.checked)}
              className="accent-signal"
            />
            Receipt / proof of purchase on file
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-[0.15em] px-4 py-2 border border-line text-muted hover:border-ink hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="font-mono text-[11px] uppercase tracking-[0.15em] px-4 py-2 bg-signal text-white hover:bg-ink transition-colors"
          >
            Save item
          </button>
        </div>
      </div>
    </div>
  )
}
