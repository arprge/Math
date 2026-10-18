import { useI18n } from "../i18n"
import type { WarrantyItem } from "../domain/warranty"
import type { WarrantyRisk } from "../stats"
import { barcodesFrom } from "../lib/barcode"
import StatusDot from "./StatusDot"
import RiskFlag from "./RiskFlag"

/** One record rendered as a thermal till receipt. */
export default function ReceiptCard({
  it,
  days,
  status,
  expiry,
  risk,
  fresh = false,
}: {
  it: WarrantyItem
  days: number
  status: "expired" | "soon" | "active"
  expiry: Date
  risk?: WarrantyRisk
  fresh?: boolean
}) {
  const { t, fmt } = useI18n()
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
      className={`receipt-card relative group ${fresh ? "print-in" : ""}`}
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
          {it.brand} · {fmt.category(it.category)}
        </div>

        {/* Time remaining — hero stat */}
        <div
          className={`font-mono font-bold text-3xl tracking-tight leading-none mb-2 ${timeColor} ${
            status === "expired" ? "uppercase" : ""
          }`}
        >
          {status === "expired" ? t("status.expired") : fmt.left(days)}
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
            <span className="text-muted uppercase">{t("receipt.purchased")}</span>
            <span className="shrink-0">{fmt.date(new Date(it.purchaseDate))}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted uppercase">{t("receipt.expires")}</span>
            <span className="shrink-0">{fmt.date(expiry)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted uppercase">{t("receipt.warranty")}</span>
            <span className="shrink-0">{fmt.warranty(it.warrantyMonths)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted uppercase">{t("receipt.value")}</span>
            <span className="shrink-0">{fmt.money(it.price)}</span>
          </div>
        </div>

        {risk && <RiskFlag risk={risk} />}

        <div className="mt-auto">
          <div className="font-mono text-[9px] text-muted truncate mb-1.5">
            SN/{it.serial}
          </div>

          {it.receipt ? (
            <div className="font-mono text-[9px] uppercase text-ok mb-3">
              {t("receipt.onFile")}
            </div>
          ) : (
            <div className="font-mono text-[9px] uppercase text-signal mb-3">
              {t("receipt.none")}
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
