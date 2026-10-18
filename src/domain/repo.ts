// Async warranty repository backed by localStorage.
// Simulates a little latency so loading/saving states are real, and supports
// a dev-only failure toggle: `?fail=load` or `?fail=save`.
// `faultSource` is an optional external hook (see src/dev/StateDemo.tsx).

import type { WarrantyItem } from "./warranty"
import { SEED } from "./seed"

const KEY = "warranty-keeper:items:v1"
const LOAD_MS = 650
const SAVE_MS = 550

export type ItemDraft = Omit<WarrantyItem, "id">

export class RepoError extends Error {
  code: "LOAD_FAILED" | "SAVE_FAILED"
  constructor(code: RepoError["code"], message: string) {
    super(message)
    this.code = code
  }
}

export type Fault = { fail?: "load" | "save" | null; loadDelayMs?: number }
export const faultSource: { current: (() => Fault) | null } = { current: null }

function failMode(): string | null {
  const injected = faultSource.current?.().fail
  if (injected) return injected
  if (!import.meta.env.DEV || typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get("fail")
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function read(): WarrantyItem[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return SEED
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error("Malformed register")
  return parsed as WarrantyItem[]
}

export async function loadItems(): Promise<WarrantyItem[]> {
  await wait(faultSource.current?.().loadDelayMs ?? LOAD_MS)
  if (failMode() === "load") {
    throw new RepoError("LOAD_FAILED", "The register could not be read.")
  }
  try {
    return read()
  } catch {
    throw new RepoError("LOAD_FAILED", "The stored register is unreadable.")
  }
}

export async function saveItem(draft: ItemDraft): Promise<WarrantyItem> {
  await wait(SAVE_MS)
  if (failMode() === "save") {
    throw new RepoError("SAVE_FAILED", "The record could not be filed.")
  }
  const item: WarrantyItem = { ...draft, id: crypto.randomUUID() }
  try {
    localStorage.setItem(KEY, JSON.stringify([...read(), item]))
  } catch {
    throw new RepoError("SAVE_FAILED", "Storage is full or unavailable.")
  }
  return item
}
