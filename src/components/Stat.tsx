import { useI18n } from "../i18n"

/** One cell of the stat band; shows a skeleton bar until the register is ready. */
export default function Stat({
  label,
  value,
  accent,
  pending = false,
}: {
  label: string
  value: string
  accent?: "ok" | "warn" | "signal"
  pending?: boolean
}) {
  const { t } = useI18n()
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
        {pending ? (
          <span
            aria-label={t("stats.loading")}
            className="skeleton-pulse skeleton-bar inline-block h-[0.8em] w-12 align-middle"
          />
        ) : (
          value
        )}
      </div>
    </div>
  )
}
