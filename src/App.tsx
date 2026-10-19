import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"

import {
  type WarrantyItem,
  enrichItems,
  countByStatus,
  coveredValue,
} from "./domain/warranty"
import { type ItemDraft, loadItems, saveItem } from "./domain/repo"
import Header, { type Page } from "./components/Header"
import Footer from "./components/Footer"
import ArchivePage from "./pages/Archive"
import RegisterPage, { type Filter, type ViewMode } from "./pages/Register"
import { warmReader } from "./scan/ocr"
import { useI18n } from "./i18n"
import { buildStatContext, priceCoverStat, warrantyRiskStat } from "./stats"

// The scanner UI loads on first intent (hover/focus) or when opened.
const loadRegisterDialog = () => import("./scan/RegisterDialog")
const RegisterDialog = lazy(loadRegisterDialog)
const prepareRegister = () => {
  loadRegisterDialog()
  warmReader({ speculative: true })
}

export type LoadState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready" }

export default function App() {
  const { t } = useI18n()
  const [items, setItems] = useState<WarrantyItem[]>([])
  const [load, setLoad] = useState<LoadState>({ status: "loading" })
  const [filter, setFilter] = useState<Filter>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("receipts")
  const [adding, setAdding] = useState(false)
  const [page, setPage] = useState<Page>("register")
  // The most recently filed record: drives the print-in and header line.
  const [printed, setPrinted] = useState<WarrantyItem | null>(null)

  const fetchItems = useCallback(() => {
    let cancelled = false
    setLoad({ status: "loading" })
    loadItems().then(
      (next) => {
        if (cancelled) return
        setItems(next)
        setLoad({ status: "ready" })
      },
      (e) => {
        if (!cancelled) setLoad({ status: "error", error: e })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => fetchItems(), [fetchItems])

  useEffect(() => {
    if (!printed) return
    const t = setTimeout(() => setPrinted(null), 3200)
    return () => clearTimeout(t)
  }, [printed])

  const addItem = async (draft: ItemDraft) => {
    const saved = await saveItem(draft)
    setItems((s) => [...s, saved])
    setPrinted(saved)
  }

  const ready = load.status === "ready"

  const enriched = useMemo(() => enrichItems(items), [items])
  const counts = useMemo(() => countByStatus(enriched), [enriched])
  const covered = useMemo(() => coveredValue(enriched), [enriched])

  const statCtx = useMemo(() => buildStatContext(enriched), [enriched])
  const priceStats = useMemo(() => priceCoverStat.compute(statCtx), [statCtx])
  const risks = useMemo(() => warrantyRiskStat.compute(statCtx), [statCtx])
  const riskByItemId = useMemo(
    () => new Map(risks.map((risk) => [risk.item.id, risk])),
    [risks],
  )

  const visible = useMemo(
    () => (filter === "all" ? enriched : enriched.filter((e) => e.status === filter)),
    [enriched, filter],
  )

  const meta =
    load.status === "loading"
      ? { key: "loading", text: t("meta.loading"), tone: "opacity-55 skeleton-pulse" }
      : load.status === "error"
        ? { key: "error", text: t("meta.error"), tone: "text-signal" }
        : printed
          ? { key: `printed-${printed.id}`, text: t("meta.filed", { count: items.length }), tone: "text-ok" }
          : { key: "ready", text: t("meta.onFile", { count: items.length }), tone: "opacity-55" }

  return (
    <div className="min-h-full font-body text-ink">
      <Header page={page} setPage={setPage} onReload={fetchItems} meta={meta} />

      {page === "archive" && (
        <ArchivePage enriched={enriched} load={load} onRetry={fetchItems} />
      )}

      {page === "register" && (
        <RegisterPage
          items={items}
          ready={ready}
          load={load}
          counts={counts}
          covered={covered}
          priceStats={priceStats}
          visible={visible}
          riskByItemId={riskByItemId}
          printed={printed}
          filter={filter}
          setFilter={setFilter}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onRegister={() => setAdding(true)}
          onPrepare={prepareRegister}
          onRetry={fetchItems}
        />
      )}

      <Footer ready={ready} count={items.length} />

      {adding && (
        <Suspense fallback={null}>
          <RegisterDialog onClose={() => setAdding(false)} onAdd={addItem} />
        </Suspense>
      )}
    </div>
  )
}
