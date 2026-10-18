import { useState } from "react"

import { useI18n } from "../i18n"
import type { PriceStats } from "../stats"

/** Value-covered cell with a torn-edge breakdown popover. */
export default function MoneyStat({
  value,
  stats,
}: {
  value: string
  stats: PriceStats
}) {
  const { t, fmt } = useI18n()
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
            {t("stats.value")}
          </span>
          <span
            className={`inline-block font-mono text-[9px] leading-none text-muted opacity-40 transition-all group-hover:opacity-90 ${
              open ? "rotate-180" : "rotate-90"
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
            aria-label={t("breakdown.close")}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          {/* popover — thermal-ticket voice, anchored near the value */}
          <div
            role="dialog"
            aria-label={t("breakdown.dialog")}
            className="absolute right-3 top-[calc(100%-6px)] z-50 w-[min(320px,calc(100vw-2rem))] origin-top-right animate-[moneyPop_120ms_ease-out] border-t border-x border-ink bg-paper shadow-[2px_3px_0_rgba(27,42,56,0.08),0_8px_18px_rgba(27,42,56,0.05)]"
          >
            {/* caret */}
            <div className="absolute -top-[5px] right-6 h-2.5 w-2.5 rotate-45 border-l border-t border-ink bg-paper" />

            {/* signal header rule */}
            <div className="h-[3px] w-full bg-signal" />

            <div className="px-4 pb-4 pt-3">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink">
                  {t("breakdown.title")}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted">
                  n={stats.n}
                </span>
              </div>

              <dl className="space-y-2 font-mono text-[11px]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">{t("breakdown.median")}</dt>
                  <dd className="font-bold tabular-nums text-ink">
                    {fmt.money(stats.median)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">{t("breakdown.core")}</dt>
                  <dd className="shrink-0 tabular-nums text-ink">
                    {fmt.money(stats.q1)} – {fmt.money(stats.q3)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="pl-3 text-[10px] text-muted opacity-70">
                    {t("breakdown.iqr")}
                  </dt>
                  <dd className="tabular-nums text-muted">{fmt.money(stats.iqr)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">{t("breakdown.outliers")}</dt>
                  <dd className="tabular-nums text-ink">
                    {stats.outliers.length === 0 ? (
                      <span className="text-ok">{t("breakdown.none")}</span>
                    ) : (
                      <span className="text-signal">
                        {t("breakdown.above", {
                          count: stats.outliers.length,
                          fence: fmt.money(stats.fence),
                        })}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="receipt-dash my-3" />

              {/* Cash-gap risk — the urgency line */}
              <div className="flex items-start gap-2">
                <span
                  className={`mt-[3px] h-2 w-2 shrink-0 ${
                    highRisk ? "bg-signal" : "bg-ok"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <div
                    className={`font-mono text-[11px] font-bold leading-snug ${
                      highRisk ? "text-signal" : "text-ink"
                    }`}
                  >
                    {t("breakdown.cashGap", { pct: Math.round(stats.p * 100) })}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] leading-snug text-muted">
                    {t("breakdown.cashGapDetail", {
                      soon: stats.soon,
                      n: stats.n,
                      p: fmt.number(stats.p, 2),
                    })}
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
