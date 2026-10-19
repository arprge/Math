import { memo } from "react"

import { useI18n } from "../i18n"
import type { WarrantyItem } from "../domain/warranty"

/** Draining cover bar + time-left label for a list row. */
function ProgressLeft({
  item,
  days,
  status,
}: {
  item: WarrantyItem
  days: number
  status: "expired" | "soon" | "active"
}) {
  const { t, fmt } = useI18n()
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
        className={`font-mono text-sm font-bold tabular-nums md:order-1 ${label} ${status === "expired" ? "uppercase" : ""
          }`}
      >
        {status === "expired" ? t("status.expired") : fmt.left(days)}
      </span>
    </div>
  )
}

export default memo(ProgressLeft)
