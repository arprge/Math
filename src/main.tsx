import { createRoot } from 'preact/compat/client'
import App from './App'
import { I18nProvider } from './i18n'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
)

// Cache the OCR runtime (wasm + worker) past GitHub Pages' 10-minute cache
// window. Dev keeps no service worker so hot reload stays predictable.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {})
  })
}
