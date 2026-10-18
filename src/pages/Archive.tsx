import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { type EnrichedItem, groupByMonth } from "../domain/warranty"
import { useI18n } from "../i18n"
import type { LoadState } from "../App"
import StatusDot from "../components/StatusDot"

type ArchiveFilter = "all" | "filed" | "missing"

/** Thin perspective lines for one shelf compartment, drawn in ink hairlines. */
function Compartment({ first }: { first: boolean }) {
  const L = 9
  const R = 91
  const T = first ? 20 : 0
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full text-ink"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      >
        {first && (
          <>
            <line
              x1="0"
              y1="0"
              x2={L}
              y2={T}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="100"
              y1="0"
              x2={R}
              y2={T}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={L}
              y1={T}
              x2={R}
              y2={T}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        <line x1={L} y1={T} x2={L} y2="100" vectorEffect="non-scaling-stroke" />
        <line x1={R} y1={T} x2={R} y2="100" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  )
}

/** Open document boxes: a low front, visible papers, and a recessed back wall. */
const zig = (w: number) =>
  Array.from({ length: Math.floor(w / 4) }, () => "l2 -1.8l2 1.8").join("")

/** What peeks out of a box; rotates by position so a shelf reads as varied storage. */
function BoxContents({ kind, n }: { kind: number; n: number }) {
  const s = { vectorEffect: "non-scaling-stroke" } as const
  if (kind === 0) {
    // Staircase of receipts with zigzag tear-off tops, receding toward the back.
    return (
      <>
        {Array.from({ length: n }).map((_, j) => {
          const back = n - 1 - j
          const x = 14 + back * 4
          const y = 28 - back * 3.5
          return (
            <g key={j}>
              <path d={`M${x} 38V${y}${zig(48)}V38`} fill="var(--color-receipt)" {...s} />
              {j === n - 1 && <path d={`M${x + 6} ${y + 5}H${x + 26}`} strokeOpacity=".35" {...s} />}
            </g>
          )
        })}
      </>
    )
  }
  if (kind === 1) {
    // Tabbed file cards standing side by side, each with a hole punch and a printed line.
    return (
      <>
        {Array.from({ length: n }).map((_, j) => {
          const x = 10 + j * 13
          const y = 20 + ((j * 5) % 7)
          return (
            <g key={j}>
              <path d={`M${x} 38V${y}H${x + 22}l3 3V38`} fill="var(--color-receipt)" {...s} />
              <circle cx={x + 4} cy={y + 4} r="1.4" fill="currentColor" stroke="none" />
              <path d={`M${x + 8} ${y + 4}H${x + 17}`} strokeWidth="1.6" strokeOpacity=".5" {...s} />
            </g>
          )
        })}
      </>
    )
  }
  // Lid resting on top with a finger notch, one slip escaping from under it.
  return (
    <>
      {n > 0 && <path d={`M58 34V24${zig(16)}V34`} fill="var(--color-receipt)" {...s} />}
      <path d="M0 38 9 33H95L86 38ZM-1 38V34.5H31V36H55V34.5H87V38Z" fill="var(--color-receipt)" {...s} />
    </>
  )
}

function ArchiveBox({
  label,
  count,
  missing,
  open,
  variant,
  onOpen,
  boxRef,
}: {
  label: string
  count: number
  missing: number
  open: boolean
  variant: number
  onOpen: () => void
  boxRef: (el: HTMLButtonElement | null) => void
}) {
  const { t } = useI18n()
  const active = open && count > 0
  const kind = count === 0 ? 2 : variant % 3
  const summary = t("archive.box", { label, count })
  const missingText = missing ? t("archive.boxMissing", { n: missing }) : ""
  return (
    <button
      ref={boxRef}
      onClick={onOpen}
      disabled={count === 0}
      aria-pressed={open}
      aria-label={missingText ? `${summary}, ${missingText}` : summary}
      title={missingText ? `${summary} · ${missingText}` : summary}
      className={`group relative min-w-0 flex-[0_1_8rem] text-left transition-transform duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-default ${
        active ? "-translate-y-1.5" : "enabled:hover:-translate-y-0.5"
      } motion-reduce:transform-none`}
    >
      <span aria-hidden className="relative block aspect-[5/4] w-full max-w-40 [container-type:inline-size]">
        <svg viewBox="0 0 100 80" className={`absolute inset-0 h-full w-full overflow-visible text-ink ${count === 0 ? "opacity-45" : ""}`} fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
          {/* Open mouth of the box, seen slightly from above. */}
          <path d="M0 38 9 33H95L86 38Z" fill="var(--color-line)" vectorEffect="non-scaling-stroke" />
          <g
            className={`transition-transform duration-300 ease-out motion-reduce:transition-none ${
              active ? "-translate-y-[4px]" : "group-enabled:group-hover:-translate-y-[2px]"
            }`}
          >
            <BoxContents kind={kind} n={Math.max(1, Math.min(count, kind === 1 ? 3 : 4))} />
          </g>
          {/* Side panel receding to the right. */}
          <path d="M86 38 95 33V74L86 80Z" fill="var(--color-line)" vectorEffect="non-scaling-stroke" />
          {/* Flat front face carrying the label. */}
          <rect x="0" y="38" width="86" height="42" className={active ? "fill-ink" : "fill-receipt"} vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          className={`absolute left-0 right-[14%] top-[47.5%] bottom-0 flex flex-col items-center justify-center gap-[2.5cqw] ${
            active ? "text-paper" : count === 0 ? "text-muted/70" : "text-ink"
          }`}
        >
          <span className="font-display font-medium leading-none text-[max(10px,13cqw)]">
            {label.slice(0, 3)}
          </span>
          <span
            className={`flex items-center gap-[1.5cqw] font-mono leading-none tabular-nums text-[max(8px,7.5cqw)] ${
              active ? "opacity-70" : "text-muted"
            }`}
          >
            {count === 0 ? "—" : count}
            {missing > 0 && (
              <span className={`size-[max(4px,3cqw)] rounded-full ${active ? "bg-paper" : "bg-signal"}`} />
            )}
          </span>
        </span>
      </span>
    </button>
  )
}

/** Shelf plank in perspective: back seam, receding ends, and a thick front edge. */
function ShelfBoard() {
  return (
    <svg aria-hidden viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-10 w-full text-ink" fill="none" stroke="currentColor">
      {/* Top surface hides the side walls behind it; seam meets the back wall. */}
      <path d="M9 4H91L100 28H0Z" fill="var(--color-paper)" stroke="none" />
      <path d="M9 4H91" strokeOpacity=".7" vectorEffect="non-scaling-stroke" />
      <path d="M9 4 0 28M91 4 100 28" strokeOpacity=".7" vectorEffect="non-scaling-stroke" />
      {/* Front edge: two parallel lines give the plank its thickness. */}
      <path d="M0 28H100V38H0Z" fill="var(--color-paper)" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Thin side arrow that turns the closet to other years; shown on hover. */
function ClosetArrow({
  dir,
  label,
  onClick,
}: {
  dir: "prev" | "next"
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`absolute top-1/2 z-10 flex h-16 w-6 -translate-y-1/2 items-center justify-center text-ink opacity-0 transition-opacity duration-200 ease-out group-hover/closet:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ink pointer-coarse:opacity-100 ${
        dir === "prev" ? "-left-6" : "-right-6"
      }`}
    >
      <svg aria-hidden viewBox="0 0 12 40" className="h-10 w-3" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "prev" ? "M10 2 2 20l8 18" : "M2 2l8 18-8 18"} />
      </svg>
    </button>
  )
}

export default function ArchivePage({
  enriched,
  load,
  onRetry,
}: {
  enriched: EnrichedItem[]
  load: LoadState
  onRetry: () => void
}) {
  const { t, fmt } = useI18n()
  const ready = load.status === "ready"
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ArchiveFilter>("all")
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const boxRefs = useRef(new Map<string, HTMLButtonElement>())
  const searchRef = useRef<HTMLInputElement>(null)

  const counts = useMemo(() => {
    const filed = enriched.filter((e) => e.it.receipt).length
    return { all: enriched.length, filed, missing: enriched.length - filed }
  }, [enriched])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = enriched.filter((e) => {
      if (filter === "filed" && !e.it.receipt) return false
      if (filter === "missing" && e.it.receipt) return false
      if (!q) return true
      const { product, brand, store, serial, category } = e.it
      return [product, brand, store, serial, category].some((v) =>
        v.toLowerCase().includes(q),
      )
    })
    return groupByMonth(matches)
  }, [enriched, query, filter])

  const byKey = useMemo(() => new Map(groups.map((g) => [g.key, g])), [groups])

  // Shelves hold every month that has ever had a receipt, so boxes never
  // jump around while searching; non-matching boxes simply go quiet.
  const shelves = useMemo(() => {
    const all = groupByMonth(enriched)
    const years = new Map<string, string[]>()
    for (const g of all) {
      const y = g.key.slice(0, 4)
      years.set(y, [...(years.get(y) ?? []), g.key])
    }
    return [...years.entries()].map(([year, keys]) => ({
      year,
      keys: keys.sort(),
    }))
  }, [enriched])
  const boxOrder = useMemo(() => shelves.flatMap((s) => s.keys), [shelves])

  // The unit shows four years at a time; arrows page through the rest.
  const PER_CLOSET = 4
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(shelves.length / PER_CLOSET))
  const safePage = Math.min(page, pages - 1)
  const visibleShelves = shelves.slice(
    safePage * PER_CLOSET,
    safePage * PER_CLOSET + PER_CLOSET,
  )
  const pageOf = (key: string) =>
    Math.floor(shelves.findIndex((s) => s.keys.includes(key)) / PER_CLOSET)
  const yearsOn = (p: number) =>
    shelves
      .slice(p * PER_CLOSET, p * PER_CLOSET + PER_CLOSET)
      .map((s) => s.year)
      .join(t("archive.and"))

  const activeKey =
    openKey && byKey.has(openKey) ? openKey : (groups[0]?.key ?? null)
  const open = activeKey ? byKey.get(activeKey)! : null
  const entries = open?.entries ?? []
  const selected = entries.find((e) => e.it.id === selectedId) ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === "Escape" && selectedId) setSelectedId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedId])

  const onRowKey = (e: ReactKeyboardEvent, index: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    e.preventDefault()
    const next = entries[index + (e.key === "ArrowDown" ? 1 : -1)]
    if (!next) return
    rowRefs.current.get(next.it.id)?.focus()
    if (selectedId) setSelectedId(next.it.id)
  }

  // Arrow keys walk the boxes in shelf order, skipping empty ones.
  const onShelfKey = (e: ReactKeyboardEvent) => {
    const dir =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0
    if (!dir || !activeKey) return
    e.preventDefault()
    let i = boxOrder.indexOf(activeKey) + dir
    while (boxOrder[i] && !byKey.has(boxOrder[i])) i += dir
    const key = boxOrder[i]
    if (!key) return
    setOpenKey(key)
    setSelectedId(null)
    setPage(pageOf(key))
    requestAnimationFrame(() => boxRefs.current.get(key)?.focus())
  }

  const turnPage = (next: number) => {
    setPage(next)
    setSelectedId(null)
    // Open the newest box with matches on the revealed shelves.
    const keys = shelves
      .slice(next * PER_CLOSET, next * PER_CLOSET + PER_CLOSET)
      .flatMap((s) => [...s.keys].reverse())
    const first = keys.find((k) => byKey.has(k))
    if (first) setOpenKey(first)
  }

  const label = (key: string) => fmt.month(key)
  const groupLabel = (key: string) => fmt.upper(`${fmt.month(key)} ${key.slice(0, 4)}`)

  return (
    <main className="mx-auto max-w-6xl px-6 pt-8 pb-16 sm:pt-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="contents">
          <label className="flex items-center gap-3 w-full rounded-[3px] border border-ink/70 bg-receipt px-3.5 sm:w-96 py-2.5 focus-within:border-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-4 shrink-0 text-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5 14 14" strokeLinecap="round" />
            </svg>
            <span className="sr-only">{t("archive.search")}</span>
            <input
              ref={searchRef}
              value={query}
              disabled={!ready}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("archive.placeholder")}
              className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none disabled:cursor-default sm:text-sm"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted hover:text-ink"
              >
                {t("archive.clear")}
              </button>
            ) : (
              <kbd className="hidden font-mono text-[10px] text-muted sm:block">
                Ctrl K
              </kbd>
            )}
          </label>
          <div
            role="group"
            aria-label={t("archive.filterLabel")}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-2 px-4 font-mono text-[10px] uppercase tracking-[0.2em]"
          >
            {(["all", "filed", "missing"] as ArchiveFilter[]).map((f, i) => {
              const active = filter === f
              return (
                <span key={f} className="flex items-baseline gap-3">
                  {i > 0 && <span className="text-muted opacity-50">·</span>}
                  <button
                    onClick={() => setFilter(f)}
                    disabled={!ready}
                    aria-pressed={active}
                    className={`whitespace-nowrap border-b pb-0.5 transition-colors ${
                      active
                        ? "border-ink text-ink"
                        : "border-transparent text-muted hover:text-ink"
                    }`}
                  >
                    {t(`archive.filter.${f}`)}{" "}
                    <span
                      className={`tabular-nums ${
                        ready && f === "missing" && counts.missing > 0
                          ? "text-signal"
                          : "opacity-60"
                      }`}
                    >
                      {ready ? counts[f] : "–"}
                    </span>
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* The shelf unit: double frame, one compartment per year. */}
      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,48rem)_minmax(18rem,1fr)]">
      <div className="group/closet relative mx-auto w-full max-w-[48rem]">
      {safePage > 0 && (
        <ClosetArrow dir="prev" label={t("archive.newer", { years: yearsOn(safePage - 1) })} onClick={() => turnPage(safePage - 1)} />
      )}
      {safePage < pages - 1 && (
        <ClosetArrow dir="next" label={t("archive.older", { years: yearsOn(safePage + 1) })} onClick={() => turnPage(safePage + 1)} />
      )}
      <div
        className={`border border-ink p-1.5 ${
          load.status === "loading" ? "skeleton-pulse" : ""
        }`}
      >
        <div
          className="border border-ink"
          role="group"
          aria-label={t("archive.shelves")}
          onKeyDown={onShelfKey}
        >
          {visibleShelves.map((s, si) => (
            <section
              key={s.year}
              aria-label={t("archive.shelf", { year: s.year })}
              className="relative pb-3"
            >
              <Compartment first={si === 0} />
              <ShelfBoard />
              <div
                className={`relative flex min-h-[9.5rem] items-end justify-center gap-1 px-[11%] pb-0 sm:gap-3 ${
                  si === 0 ? "pt-12" : "pt-7"
                }`}
              >
                <span className="absolute top-2 left-[11%] font-mono text-[10px] tracking-[0.2em] text-muted tabular-nums sm:left-[calc(9%+0.6rem)]">
                  {s.year}
                </span>
                {s.keys.map((key, ki) => {
                  const g = byKey.get(key)
                  return (
                    <ArchiveBox
                      key={key}
                      label={label(key)}
                      count={g?.entries.length ?? 0}
                      missing={
                        g?.entries.filter((e) => !e.it.receipt).length ?? 0
                      }
                      open={key === activeKey}
                      variant={ki}
                      onOpen={() => {
                        setOpenKey(key)
                        setSelectedId(null)
                      }}
                      boxRef={(el) => {
                        if (el) boxRefs.current.set(key, el)
                        else boxRefs.current.delete(key)
                      }}
                    />
                  )
                })}
              </div>
            </section>
          ))}
          {Array.from({ length: PER_CLOSET - visibleShelves.length }).map(
            (_, k) => (
              <section
                key={`empty-${k}`}
                aria-hidden
                className="relative min-h-[9.5rem] pb-3"
              >
                <Compartment first={visibleShelves.length + k === 0} />
                <ShelfBoard />
              </section>
            ),
          )}
        </div>
      </div>

      </div>

      {/* Contents of the open box: the ruled ledger. */}
      <div className="flex min-w-0 items-start gap-8">
        <section
          aria-label={
            open
              ? t("archive.contentsOf", { label: groupLabel(open.key) })
              : t("archive.boxContents")
          }
          className="min-w-0 flex-1"
        >
          {load.status === "loading" ? (
            <LedgerSkeleton />
          ) : load.status === "error" ? (
            <div role="alert" className="border-t border-ink py-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-signal">
                {t("archive.notRead")}
              </div>
              <p className="mt-2 font-mono text-xs leading-relaxed text-muted">
                {fmt.error(load.error)} {t("archive.untouched")}{" "}
                <button
                  onClick={onRetry}
                  className="border-b border-ink text-ink"
                >
                  {t("states.tryAgain")}
                </button>
              </p>
            </div>
          ) : open ? (
            <>
              <div className="flex items-baseline justify-between gap-3 border-b border-ink pb-2">
                <h3 className="font-display text-xl font-extrabold tracking-tight">
                  {groupLabel(open.key)}
                </h3>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-muted tabular-nums">
                  {t("archive.inBox", { count: entries.length })}
                </span>
              </div>
              <ul>
                {entries.map((e, index) => {
                  const active = e.it.id === selectedId
                  return (
                    <li key={e.it.id} className="border-b border-line">
                      <button
                        ref={(el) => {
                          if (el) rowRefs.current.set(e.it.id, el)
                          else rowRefs.current.delete(e.it.id)
                        }}
                        onClick={() => setSelectedId(active ? null : e.it.id)}
                        onKeyDown={(ev) => onRowKey(ev, index)}
                        aria-pressed={active}
                        className={`grid w-full grid-cols-[2rem_1fr_auto] items-baseline gap-3 py-3 pr-1 text-left transition-[padding] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:grid-cols-[2.5rem_1fr_auto] sm:gap-5 ${
                          active
                            ? "pl-3 shadow-[inset_2px_0_0_var(--color-ink)]"
                            : "pl-0 hover:pl-1.5"
                        }`}
                      >
                        <span className="font-mono text-[11px] tabular-nums text-muted">
                          {String(
                            new Date(e.it.purchaseDate).getDate(),
                          ).padStart(2, "0")}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-display text-base font-bold leading-tight">
                            {e.it.product}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-muted">
                            {e.it.store} · {fmt.money(e.it.price)}
                          </span>
                        </span>
                        <span
                          className={`font-mono text-[9px] uppercase tracking-[0.15em] ${
                            e.it.receipt ? "text-muted" : "text-signal"
                          }`}
                        >
                          {e.it.receipt ? t("archive.filed") : t("archive.missing")}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="border-t border-ink py-10 font-mono text-xs text-muted">
              {query
                ? `${t("archive.nothingFiled", { query })} `
                : `${t("archive.noMatch")} `}
              <button
                onClick={() => {
                  setQuery("")
                  setFilter("all")
                }}
                className="border-b border-ink text-ink"
              >
                {t("archive.clearSearch")}
              </button>
            </p>
          )}
        </section>

        {selected && (
          <>
            <button
              aria-label={t("archive.closePreview")}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 z-40 bg-ink/30 md:hidden"
            />
            <aside
              aria-label={t("archive.preview")}
              className="archive-slip fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-auto bg-receipt md:sticky md:top-6 md:inset-auto md:z-auto md:w-72 md:shrink-0 md:max-h-none"
            >
              <Preview entry={selected} onClose={() => setSelectedId(null)} />
            </aside>
          </>
        )}
      </div>
      </div>
    </main>
  )
}

function Preview({
  entry,
  onClose,
}: {
  entry: EnrichedItem
  onClose: () => void
}) {
  const { t, fmt } = useI18n()
  const { it, status, days, expiry } = entry
  const rows: [string, string][] = [
    [t("archive.store"), it.store],
    [t("archive.purchased"), fmt.date(new Date(it.purchaseDate))],
    [t("archive.expires"), fmt.date(expiry)],
    [t("archive.cover"), status === "expired" ? t("status.expired") : fmt.left(days)],
    [t("archive.value"), fmt.money(it.price)],
    [t("archive.serial"), it.serial],
  ]
  return (
    <div className="px-5 pt-4 pb-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {t("archive.receipt")}
        </span>
        <button
          onClick={onClose}
          className="font-mono text-[10px] text-muted hover:text-ink"
        >
          ESC ✕
        </button>
      </div>
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <h2 className="font-display text-xl font-extrabold leading-tight">
          {it.product}
        </h2>
      </div>
      <div className="mt-1 font-mono text-[10px] text-muted">
        {it.brand} · {fmt.category(it.category)}
      </div>
      <div className="receipt-dash my-3" />
      <dl className="space-y-1.5 font-mono text-[10px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="shrink-0 uppercase text-muted">{k}</dt>
            <dd className="truncate text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="receipt-dash my-3" />
      <div
        className={`font-mono text-[10px] uppercase tracking-[0.15em] ${
          it.receipt ? "text-ok" : "text-signal"
        }`}
      >
        {it.receipt
          ? t("archive.proof")
          : t("archive.noReceipt")}
      </div>
    </div>
  )
}

/** Ruled ledger with blank lines while the archive is being read. */
function LedgerSkeleton() {
  const { t } = useI18n()
  return (
    <div role="status" aria-label={t("archive.loading")}>
      <span className="sr-only">{t("archive.loading")}…</span>
      <div
        aria-hidden
        className="flex items-baseline justify-between border-b border-ink pb-3"
      >
        <div className="skeleton-pulse skeleton-bar h-4 w-28" />
        <div className="skeleton-pulse skeleton-bar h-1.5 w-12" />
      </div>
      <ul aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="skeleton-pulse grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-line py-3.5 sm:grid-cols-[2.5rem_1fr_auto] sm:gap-5"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <div className="skeleton-bar h-1.5 w-4" />
            <div className="space-y-2">
              <div className="skeleton-bar h-2.5 w-3/5" />
              <div className="skeleton-bar h-1.5 w-2/5" />
            </div>
            <div className="skeleton-bar h-1.5 w-10" />
          </li>
        ))}
      </ul>
    </div>
  )
}
