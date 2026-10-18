import { useI18n } from "../i18n"
import type { WarrantyRisk } from "../stats"

/** Persistent service-priority dot with a hover/focus-revealed recommendation. */
export default function RiskFlag({ risk }: { risk: WarrantyRisk }) {
  const { t } = useI18n()
  const tone =
    risk.level === "high" || risk.level === "expired"
      ? "bg-signal text-white"
      : risk.level === "watch"
        ? "bg-warn text-ink"
        : "bg-ok text-white"

  return (
    <div className="mb-3 border-t border-line pt-3">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 h-2 w-2 shrink-0 ${tone}`} aria-hidden />
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
            {t(`risk.${risk.level}.label`)}
          </div>
          <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-h-16 group-hover:opacity-100 group-focus-within:max-h-16 group-focus-within:opacity-100">
            <p className="mt-0.5 font-mono text-[10px] leading-snug text-muted">
              {t(`risk.${risk.level}.rec`)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
