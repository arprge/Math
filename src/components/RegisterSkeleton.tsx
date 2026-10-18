import { useI18n } from "../i18n"

/** Blank receipt paper standing in for records that are still being read. */
export default function RegisterSkeleton({
  viewMode,
}: {
  viewMode: "list" | "receipts"
}) {
  const { t } = useI18n()
  return (
    <div role="status" aria-label={t("states.loadingRecords")}>
      <span className="sr-only">{t("states.loadingRecords")}…</span>
      {viewMode === "receipts" ? (
        <div
          aria-hidden
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="receipt-card is-blank"
              style={{ background: "var(--color-receipt)" }}
            >
              <div className="receipt-perf-top" />
              <div
                className="skeleton-pulse flex flex-1 flex-col px-5 pt-4 pb-4"
                style={{ animationDelay: `${i * 140}ms` }}
              >
                <div className="skeleton-bar mb-2 h-2 w-2" />
                <div className="skeleton-bar mb-4 h-1.5 w-2/5" />
                <div className="receipt-dash mb-4" />
                <div className="skeleton-bar mb-2 h-3.5 w-4/5" />
                <div className="skeleton-bar mb-5 h-1.5 w-1/3" />
                <div className="skeleton-bar mb-3 h-6 w-1/2" />
                <div className="skeleton-bar mb-4 h-1.5 w-full opacity-40" />
                <div className="receipt-dash mb-4" />
                <div className="space-y-2.5">
                  {[0, 1, 2, 3].map((r) => (
                    <div key={r} className="flex justify-between gap-3">
                      <div className="skeleton-bar h-1.5 w-1/4" />
                      <div className="skeleton-bar h-1.5 w-1/5" />
                    </div>
                  ))}
                </div>
                <div className="mt-auto">
                  <div className="skeleton-bar mb-3 h-1.5 w-2/5" />
                  <div className="skeleton-bar h-8 w-full opacity-35" />
                </div>
              </div>
              <div className="receipt-perf-bottom" />
            </div>
          ))}
        </div>
      ) : (
        <ul aria-hidden className="border border-line bg-receipt soft-raised">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="skeleton-pulse grid md:grid-cols-[1fr_auto_auto_auto] gap-3 md:gap-6 items-center px-4 py-4 border-b border-line last:border-b-0"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <div className="space-y-2">
                <div className="skeleton-bar h-3 w-1/2" />
                <div className="skeleton-bar h-1.5 w-1/3" />
              </div>
              <div className="skeleton-bar hidden h-1.5 w-20 md:block md:ml-8" />
              <div className="skeleton-bar hidden h-1.5 w-20 md:block md:ml-8" />
              <div className="skeleton-bar h-1.5 w-24 md:ml-16" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
