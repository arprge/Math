// Keeps the OCR runtime on disk so repeat scans never wait for the network.
// GitHub Pages only sends `Cache-Control: max-age=600`, so without this the
// ~14 MB onnxruntime wasm is revalidated (and eventually re-downloaded) every
// ten minutes. Model weights are already cached by the reader worker under
// `wk-ocr-v2`, so they are deliberately not duplicated here.
const CACHE = "wk-runtime-v1"
// Four builds' worth of hashed assets, enough for a deploy plus a rollback.
const KEEP = 4

self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith("wk-runtime-") && name !== CACHE)
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

const isRuntimeAsset = (url) =>
  url.pathname.endsWith(".wasm") || /\/ocr\.worker-[\w-]+\.js$/.test(url.pathname)

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !isRuntimeAsset(url)) return
  event.respondWith(cacheFirst(request))
})

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit

  const response = await fetch(request)
  if (response.ok && response.type === "basic") {
    try {
      await cache.put(request, response.clone())
      await trim(cache)
    } catch {
      // Quota or a private-mode cache can fail; the response is still usable.
    }
  }
  return response
}

async function trim(cache) {
  const keys = await cache.keys()
  if (keys.length <= KEEP) return
  await Promise.all(keys.slice(0, keys.length - KEEP).map((key) => cache.delete(key)))
}
