import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { ReactNode } from "preact/compat"
import type { TargetedEvent } from "preact"

import type { ItemDraft } from "../domain/repo"
import { TODAY } from "../domain/warranty"
import type { Quad } from "./engine"
import type { Guess } from "./parseReceipt"
import { readerStatus, scanReceipt, subscribeReader, warmReader } from "./ocr"
import { useI18n } from "../i18n"

type Conf = Guess["conf"]
type Notice = "unsupported" | "noText" | "notReceipt" | "readFailed" | "readerDownload"
/** Errors are kept as codes so they re-render in the current language. */
type FormError = { kind: "productRequired" } | { kind: "save"; cause: unknown }
type Step =
  | { kind: "choose"; notice?: Notice }
  | { kind: "camera" }
  | { kind: "scan"; image: ImageBitmap; quads: Quad[] }
  | { kind: "review"; image: ImageBitmap; quads: Quad[]; conf: Conf; ms?: number; notice?: Notice }

// Stored values stay English (risk priors key on them); only labels translate.
const CATEGORIES = ["Electronics", "Appliance", "Wearable", "Furniture", "Vehicle", "Other"]
const BLANK: ItemDraft = {
  product: "",
  brand: "",
  category: "Electronics",
  serial: "",
  store: "",
  purchaseDate: TODAY.toISOString().slice(0, 10),
  warrantyMonths: 12,
  price: 0,
  receipt: true,
}

const SCAN_MAX = 2400

function scanBitmapOptions(image: ImageBitmap): ImageBitmapOptions | undefined {
  const scale = Math.min(1, SCAN_MAX / Math.max(image.width, image.height))
  if (scale === 1) return undefined
  return {
    resizeWidth: Math.max(1, Math.round(image.width * scale)),
    resizeHeight: Math.max(1, Math.round(image.height * scale)),
    resizeQuality: "high",
  }
}

export default function RegisterDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (draft: ItemDraft) => Promise<void>
}) {
  const { t, fmt } = useI18n()
  const [step, setStep] = useState<Step>({ kind: "choose" })
  const [form, setForm] = useState<ItemDraft>(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<FormError | null>(null)
  const [dragging, setDragging] = useState(false)
  const run = useRef(0)
  const imageRef = useRef<ImageBitmap | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const systemCamRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    warmReader()
    return () => {
      run.current++
      imageRef.current?.close()
    }
  }, [])

  const begin = useCallback(async (source: Blob | ImageBitmap) => {
    const token = ++run.current
    let image: ImageBitmap
    try {
      image = source instanceof Blob ? await createImageBitmap(source) : source
    } catch {
      setStep({ kind: "choose", notice: "unsupported" })
      return
    }
    if (token !== run.current) return image.close()
    imageRef.current?.close()
    imageRef.current = image
    setError(null)
    setStep({ kind: "scan", image, quads: [] })

    try {
      // The worker takes ownership of its copy; ours stays for the preview.
      const result = await scanReceipt(await createImageBitmap(image, scanBitmapOptions(image)), (quads) => {
        if (token === run.current) setStep((s) => (s.kind === "scan" ? { ...s, quads } : s))
      })
      if (token !== run.current) return
      setForm({ ...BLANK, ...result.guess.draft })
      setStep({
        kind: "review",
        image,
        quads: result.quads,
        conf: result.guess.conf,
        ms: result.ms,
        notice: !result.lines.length
          ? "noText"
          : Object.keys(result.guess.conf).length
            ? undefined
            : "notReceipt",
      })
    } catch {
      if (token !== run.current) return
      setForm(BLANK)
      // A reader that never loaded is a download problem; otherwise the scan failed.
      const notice: Notice = readerStatus().state === "error" ? "readerDownload" : "readFailed"
      setStep({ kind: "review", image, quads: [], conf: {}, notice })
    }
  }, [])

  const retake = () => {
    run.current++
    setForm(BLANK)
    setError(null)
    setStep({ kind: "choose" })
  }

  const takePhoto = () => {
    if (typeof navigator.mediaDevices?.getUserMedia === "function") setStep({ kind: "camera" })
    else systemCamRef.current?.click()
  }

  const dismiss = useCallback(() => {
    if (!saving) onClose()
  }, [saving, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (step.kind === "camera") setStep({ kind: "choose" })
      else dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step.kind, dismiss])

  useEffect(() => {
    if (step.kind !== "choose") return
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"))
      if (!file) return
      e.preventDefault()
      begin(file)
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [step.kind, begin])

  const onFile = (e: TargetedEvent<HTMLInputElement, Event>) => {
    const file = e.currentTarget.files?.[0]
    e.currentTarget.value = ""
    if (file) begin(file)
  }

  const submit = async (e: TargetedEvent<HTMLFormElement, SubmitEvent>) => {
    e.preventDefault()
    if (saving) return
    if (!form.product.trim()) {
      setError({ kind: "productRequired" })
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onAdd({ ...form, product: form.product.trim(), receipt: true })
      onClose()
    } catch (err) {
      setError({ kind: "save", cause: err })
      setSaving(false)
    }
  }

  const errorText = !error
    ? null
    : error.kind === "productRequired"
      ? t("scan.productRequired")
      : fmt.error(error.cause)

  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => {
    setError(null)
    setForm((f) => ({ ...f, [k]: v }))
  }

  const wide = step.kind === "review"

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-scrim p-4 md:items-center"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
        className={`relative my-8 w-full border border-ink bg-paper p-5 sm:p-6 ${wide ? "max-w-3xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          if (step.kind !== "choose") return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(e) => {
          if (step.kind !== "choose") return
          e.preventDefault()
          setDragging(false)
          const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"))
          if (file) begin(file)
        }}
      >
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <div className="min-w-0">
            <h2 id="register-title" className="font-display text-2xl font-extrabold tracking-tight">
              {t("scan.title")}
            </h2>
            <StepTrail current={step.kind === "review" ? 1 : 0} />
          </div>
          <button
            type="button"
            onClick={dismiss}
            disabled={saving}
            className="shrink-0 font-mono text-xs text-muted hover:text-ink disabled:opacity-40"
          >
            ESC ✕
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <input
          ref={systemCamRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />

        {step.kind === "choose" && (
          <ChooseStep
            notice={step.notice}
            onPhoto={takePhoto}
            onUpload={() => fileRef.current?.click()}
          />
        )}

        {step.kind === "camera" && (
          <CameraView
            onCapture={begin}
            onBack={() => setStep({ kind: "choose" })}
            onSystemCamera={() => systemCamRef.current?.click()}
            onUpload={() => fileRef.current?.click()}
          />
        )}

        {step.kind === "scan" && <ScanView image={step.image} quads={step.quads} />}

        {step.kind === "review" && (
          <form onSubmit={submit} noValidate>
            {step.notice && (
              <p className="meta-in mb-5 flex items-start gap-2 border border-warn/40 bg-warn/5 px-3 py-2 font-mono text-[10px] leading-snug text-warn">
                <span aria-hidden>!</span>
                <span>{t(`scan.notice.${step.notice}`)}</span>
              </p>
            )}
            <div className="grid gap-5 md:grid-cols-[minmax(0,200px)_1fr] md:gap-7">
              <aside className="flex items-center gap-4 md:flex-col md:items-stretch">
                <div className="relative w-16 shrink-0 border border-line bg-ink/5 md:w-full">
                  <BitmapCanvas image={step.image} className="block h-auto w-full" />
                  <QuadLayer quads={step.quads} faint />
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  <span className="truncate">
                    {step.ms !== undefined
                      ? t("scan.readIn", { s: fmt.number(step.ms / 1000, 1) })
                      : t("scan.notRead")}
                  </span>
                  <button
                    type="button"
                    onClick={retake}
                    disabled={saving}
                    className="shrink-0 border-b border-ink pb-0.5 text-ink hover:text-signal hover:border-signal disabled:opacity-40"
                  >
                    {t("scan.retake")}
                  </button>
                </div>
              </aside>

              <fieldset disabled={saving} className="grid grid-cols-2 gap-x-4 gap-y-3.5 disabled:opacity-60">
                <Field label={t("scan.field.product")} conf={step.conf.product} className="col-span-2">
                  {(cls) => (
                    <input
                      className={cls}
                      value={form.product}
                      onChange={(e) => set("product", e.currentTarget.value)}
                      placeholder={t("scan.field.productPlaceholder")}
                    />
                  )}
                </Field>
                <Field label={t("scan.field.brand")} conf={step.conf.brand}>
                  {(cls) => <input className={cls} value={form.brand} onChange={(e) => set("brand", e.currentTarget.value)} />}
                </Field>
                <Field label={t("scan.field.category")} conf={step.conf.category}>
                  {(cls) => (
                    <select className={cls} value={form.category} onChange={(e) => set("category", e.currentTarget.value)}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {fmt.category(c)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={t("scan.field.serial")} conf={step.conf.serial} className="col-span-2">
                  {(cls) => (
                    <input
                      className={`${cls} font-mono`}
                      value={form.serial}
                      onChange={(e) => set("serial", e.currentTarget.value)}
                    />
                  )}
                </Field>
                <Field label={t("scan.field.purchaseDate")} conf={step.conf.purchaseDate}>
                  {(cls) => (
                    <input
                      type="date"
                      className={cls}
                      value={form.purchaseDate}
                      onChange={(e) => set("purchaseDate", e.currentTarget.value)}
                    />
                  )}
                </Field>
                <Field label={t("scan.field.warranty")} conf={step.conf.warrantyMonths}>
                  {(cls) => (
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className={cls}
                      value={form.warrantyMonths}
                      onChange={(e) => set("warrantyMonths", Number(e.currentTarget.value))}
                    />
                  )}
                </Field>
                <Field label={t("scan.field.price")} conf={step.conf.price}>
                  {(cls) => (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      className={cls}
                      value={form.price}
                      onChange={(e) => set("price", Number(e.currentTarget.value))}
                    />
                  )}
                </Field>
                <Field label={t("scan.field.store")} conf={step.conf.store}>
                  {(cls) => <input className={cls} value={form.store} onChange={(e) => set("store", e.currentTarget.value)} />}
                </Field>
              </fieldset>
            </div>

            <div aria-live="polite">
              {errorText && (
                <p className="meta-in mt-5 flex items-start gap-2 border-t border-line pt-3 font-mono text-[10px] leading-snug text-signal">
                  <span aria-hidden>✗</span>
                  <span>{errorText}</span>
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={dismiss}
                disabled={saving}
                className="border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
              >
                {t("scan.cancel")}
              </button>
              <button
                type="submit"
                autoFocus
                disabled={saving}
                aria-busy={saving}
                className="min-w-[9.5rem] bg-signal px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-white transition-colors hover:bg-ink hover:text-paper disabled:bg-ink disabled:text-paper"
              >
                {saving ? (
                  <span className="skeleton-pulse">{t("scan.printing")}</span>
                ) : error ? (
                  t("scan.retry")
                ) : (
                  t("scan.register")
                )}
              </button>
            </div>
          </form>
        )}

        {dragging && (
          <div className="pointer-events-none absolute inset-2 flex items-center justify-center border-2 border-dashed border-signal bg-paper/90 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">
            {t("scan.drop")}
          </div>
        )}
      </div>
    </div>
  )
}

function StepTrail({ current }: { current: number }) {
  const { t } = useI18n()
  return (
    <ol className="mt-1.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em]">
      {[t("scan.stepScan"), t("scan.stepCheck")].map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          {i > 0 && <span className="text-muted opacity-50">·</span>}
          <span className={i === current ? "text-ink" : "text-muted"}>
            {String(i + 1).padStart(2, "0")} {s}
          </span>
        </li>
      ))}
    </ol>
  )
}

function useReader() {
  return useSyncExternalStore(subscribeReader, readerStatus, readerStatus)
}

function ReaderLine() {
  const { t } = useI18n()
  const s = useReader()
  if (s.state === "loading")
    return (
      <span className="skeleton-pulse">
        {s.progress < 1 ? t("scan.preparing", { pct: Math.round(s.progress * 100) }) : t("scan.warming")}
      </span>
    )
  if (s.state === "error") return <span className="text-signal">{t("scan.offline")}</span>
  if (s.state === "ready")
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
        {t("scan.onDevice", { backend: s.backend === "webgpu" ? "GPU" : "CPU" })}
      </span>
    )
  return null
}

function ChooseStep({ notice, onPhoto, onUpload }: { notice?: Notice; onPhoto: () => void; onUpload: () => void }) {
  const { t } = useI18n()
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Tile index="01" title={t("scan.takePhoto")} meta={t("scan.camera")} icon={<CameraIcon />} onClick={onPhoto} autoFocus />
        <Tile index="02" title={t("scan.upload")} meta={t("scan.uploadMeta")} icon={<UploadIcon />} onClick={onUpload} />
      </div>
      {notice && (
        <p role="alert" className="meta-in mt-4 font-mono text-[10px] leading-snug text-signal">
          ✗ {t(`scan.notice.${notice}`)}
        </p>
      )}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-muted sm:text-[10px]">
        <span className="hidden sm:inline">{t("scan.dropHint")}</span>
        <span className="sm:hidden">{t("scan.fillHint")}</span>
        <ReaderLine />
      </div>
    </div>
  )
}

function Tile({
  index,
  title,
  meta,
  icon,
  onClick,
  autoFocus,
}: {
  index: string
  title: string
  meta: string
  icon: ReactNode
  onClick: () => void
  autoFocus?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className="group flex aspect-[4/3.4] flex-col justify-between border border-line bg-receipt p-4 text-left soft-key transition-colors hover:border-ink focus-visible:border-ink focus-visible:outline-none sm:aspect-[4/3]"
    >
      <div className="flex items-start justify-between">
        <span className="text-ink transition-colors group-hover:text-signal">{icon}</span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-muted">{index}</span>
      </div>
      <span>
        <span className="block font-display text-lg font-bold leading-tight hyphens-auto [overflow-wrap:break-word]">{title}</span>
        <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{meta}</span>
      </span>
    </button>
  )
}

function Field({
  label,
  conf,
  className = "",
  children,
}: {
  label: string
  conf?: number
  className?: string
  children: (cls: string) => ReactNode
}) {
  const { t } = useI18n()
  const check = conf !== undefined && conf < 0.6
  const cls = `w-full bg-paper border px-3 py-2 font-body text-sm focus:outline-none focus:border-ink transition-colors ${check ? "border-warn/60" : "border-line"
    }`
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {label}
        {conf !== undefined && (
          <span className={`text-[9px] tracking-[0.14em] ${check ? "text-warn" : "text-ok"}`}>
            {check ? t("scan.check") : t("scan.read")}
          </span>
        )}
      </span>
      {children(cls)}
    </label>
  )
}

function BitmapCanvas({ image, className }: { image: ImageBitmap; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !image.width) return
    const s = Math.min(1, 1200 / Math.max(image.width, image.height))
    c.width = Math.round(image.width * s)
    c.height = Math.round(image.height * s)
    c.getContext("2d")?.drawImage(image, 0, 0, c.width, c.height)
  }, [image])
  return <canvas ref={ref} className={className} style={{ aspectRatio: `${image.width} / ${image.height}` }} />
}

function QuadLayer({ quads, faint }: { quads: Quad[]; faint?: boolean }) {
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {quads.map((q, i) => (
        <polygon
          key={i}
          points={`${q[0]},${q[1]} ${q[2]},${q[3]} ${q[4]},${q[5]} ${q[6]},${q[7]}`}
          className={faint ? "" : "quad-in"}
          style={faint ? undefined : { animationDelay: `${Math.min(i * 14, 420)}ms` }}
          fillOpacity={faint ? 0.08 : 0.14}
          fill="var(--color-signal)"
          stroke="var(--color-signal)"
          strokeWidth={faint ? 0.75 : 1.25}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

function ScanView({ image, quads }: { image: ImageBitmap; quads: Quad[] }) {
  const { t } = useI18n()
  const s = useReader()
  const label =
    s.state === "loading"
      ? s.progress < 1
        ? t("scan.preparingScan", { pct: Math.round(s.progress * 100) })
        : t("scan.warmingScan")
      : quads.length
        ? t("scan.reading", { count: quads.length })
        : t("scan.finding")
  return (
    <div>
      <div className="relative mx-auto w-fit max-w-full overflow-hidden border border-line bg-ink/5">
        <BitmapCanvas image={image} className="block h-auto max-h-[60vh] w-auto max-w-full" />
        <QuadLayer quads={quads} />
        <div className="scan-sweep" aria-hidden />
      </div>
      <p role="status" className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span className="skeleton-pulse">{label}</span>
      </p>
    </div>
  )
}

type CamState = "starting" | "live" | "blocked" | "unavailable"

function CameraView({
  onCapture,
  onBack,
  onSystemCamera,
  onUpload,
}: {
  onCapture: (image: ImageBitmap) => void
  onBack: () => void
  onSystemCamera: () => void
  onUpload: () => void
}) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [state, setState] = useState<CamState>("starting")
  const [torch, setTorch] = useState<boolean | null>(null)
  const [flash, setFlash] = useState(0)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } },
      })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const track = s.getVideoTracks()[0]
        trackRef.current = track
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
          torch?: boolean
          focusMode?: string[]
        }
        if (caps.torch) setTorch(false)
        if (caps.focusMode?.includes("continuous")) {
          track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => { })
        }
        const v = videoRef.current
        if (!v) return
        v.srcObject = s
        await v.play().catch(() => { })
        if (!cancelled) setState("live")
      })
      .catch((e: DOMException) => {
        if (!cancelled) setState(e.name === "NotAllowedError" || e.name === "SecurityError" ? "blocked" : "unavailable")
      })
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const shoot = useCallback(async () => {
    const v = videoRef.current
    if (state !== "live" || !v?.videoWidth) return
    setFlash((n) => n + 1)
    onCapture(await createImageBitmap(v))
  }, [state, onCapture])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        shoot()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [shoot])

  const toggleTorch = () => {
    const next = !torch
    trackRef.current
      ?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorch(next))
      .catch(() => setTorch(null))
  }

  const bar = "font-mono text-[10px] uppercase tracking-[0.18em] text-white/80 hover:text-white"

  return (
    <div className="relative aspect-[3/4] max-h-[70vh] w-full overflow-hidden bg-black max-sm:fixed max-sm:inset-0 max-sm:z-[60] max-sm:aspect-auto max-sm:max-h-none">
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />

      {state === "live" && (
        <div className="pointer-events-none absolute inset-x-[10%] inset-y-[12%]" aria-hidden>
          {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((c) => (
            <span key={c} className={`absolute h-7 w-7 border-white/85 ${c}`} />
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6">
        <button type="button" onClick={onBack} className={bar}>
          {t("scan.cam.back")}
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
          {state === "live" ? t("scan.cam.fit") : state === "starting" ? t("scan.cam.starting") : ""}
        </span>
      </div>

      {(state === "blocked" || state === "unavailable") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="font-display text-lg font-bold text-white">
            {state === "blocked" ? t("scan.cam.blocked") : t("scan.cam.unavailable")}
          </p>
          <p className="max-w-xs font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-white/60">
            {state === "blocked" ? t("scan.cam.blockedHint") : t("scan.cam.unavailableHint")}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onSystemCamera} className="bg-signal px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-white hover:bg-white hover:text-black">
              {t("scan.cam.cameraApp")}
            </button>
            <button type="button" onClick={onUpload} className="border border-white/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-white hover:border-white">
              {t("scan.cam.upload")}
            </button>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 items-center bg-gradient-to-t from-black/70 to-transparent px-4 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <span />
        <button
          type="button"
          onClick={shoot}
          disabled={state !== "live"}
          aria-label={t("scan.cam.shutter")}
          className="group mx-auto grid h-[68px] w-[68px] place-items-center rounded-full border-[3px] border-white/90 disabled:opacity-40"
        >
          <span className="h-[52px] w-[52px] rounded-full bg-white transition-transform group-active:scale-90 group-hover:bg-signal" />
        </button>
        {torch !== null ? (
          <button type="button" onClick={toggleTorch} aria-pressed={torch} className={`${bar} justify-self-end ${torch ? "text-warn" : ""}`}>
            {torch ? t("scan.cam.lightOn") : t("scan.cam.lightOff")}
          </button>
        ) : (
          <span />
        )}
      </div>

      {flash > 0 && <div key={flash} className="shutter-flash pointer-events-none absolute inset-0 bg-white" aria-hidden />}
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3.5 9.5h4.2l2-3h8.6l2 3h4.2v13h-21z" strokeLinejoin="round" />
      <circle cx="14" cy="15.5" r="4.25" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M7 3.5h10l4 4v17H7z" strokeLinejoin="round" />
      <path d="M10.5 12.5h7M10.5 16h7M10.5 19.5h4.5" strokeLinecap="round" />
    </svg>
  )
}
