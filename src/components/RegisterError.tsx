import { useI18n } from "../i18n"

/** A voided slip: the register couldn't be read. */
export default function RegisterError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const { t } = useI18n()
  return (
    <div
      role="alert"
      className="mx-auto mt-6 max-w-sm"
      style={{ background: "var(--color-receipt)" }}
    >
      <div className="receipt-perf-top" />
      <div className="px-6 pt-4 pb-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-signal">
          {t("states.printError")}
        </div>
        <div className="mt-2 font-display text-xl font-extrabold leading-tight tracking-tight">
          {t("states.registerNotRead")}
        </div>
        <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted">
          {message} {t("states.untouched")}
        </p>
        <div className="receipt-dash my-4" />
        <button
          onClick={onRetry}
          className="font-mono text-[10px] uppercase tracking-[0.15em] px-4 py-1.5 border border-ink text-ink hover:bg-ink hover:text-paper transition-colors"
        >
          {t("states.tryAgain")}
        </button>
      </div>
      <div className="receipt-perf-bottom" />
    </div>
  )
}
