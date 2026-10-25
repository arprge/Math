# Warranty Keeper

[![Preact](https://img.shields.io/badge/Preact-11-673AB8?logo=preact&logoColor=white)](https://preactjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

**Keep every warranty, receipt and expiry date in one place.**

Warranty Keeper is a browser-based app for tracking the products you own and the cover
that protects them. It keeps a register of purchases with live expiry countdowns, shows
how much value is still covered, and stores your receipts in a searchable archive — so a
claim deadline never slips past unnoticed.

Everything runs locally in the browser. There is no account, no backend and no upload:
your records stay on your device, and receipt scanning works offline.

## Features

- **Product register** — store the product, brand, category, store, serial number,
  purchase price and warranty length, with a live countdown to expiry.
- **At-a-glance status** — a stat band summarising total items, active cover, items
  expiring within 60 days and the total value still covered, with a per-category breakdown.
- **Filters and views** — narrow the register to all, active, expiring soon or expired
  items, and switch between a compact list and a receipt-style grid.
- **Receipt archive** — purchases are grouped by month and shown as a shelf of boxes, with
  a ledger of every record, search, and a filed/missing receipt filter.
- **Receipt scanning** — add a receipt from the camera, a file, drag-and-drop or the
  clipboard. Text recognition runs entirely on-device and pre-fills the form for review.
- **Three languages** — English, Russian and Kazakh, with localised dates, numbers and
  plurals.
- **Responsive** — a full desktop layout and a mobile layout with a bottom-sheet detail
  view.

## Tech stack

| Layer | Technology |
|---|---|
| UI | Preact 11 compat, TypeScript 5.7 |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 (design tokens, no runtime CSS-in-JS) |
| OCR | `onnxruntime-web` running PP-OCRv6 tiny in a Web Worker |
| Storage | `localStorage` |
| Formatting | oxfmt |

## Getting started

**Requirements:** Node.js 20.19+ or 22.12+ and npm.

```bash
git clone https://github.com/arprge/Math.git
cd Math
npm install
npm run fetch-models
npm run dev
```

Open <http://localhost:8443>.

The OCR models are not stored in the repository, so `npm run fetch-models` downloads and
verifies them (~6.2 MB) on first setup. The app itself runs without them; only receipt
scanning needs the models.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server. |
| `npm run build` | Build the production bundle into `dist/`. |
| `npm run size` | Build and print JavaScript/CSS bundle sizes by file. |
| `npm run preview` | Serve the production build locally. |
| `npm run fetch-models` | Download and verify the OCR models. |
| `npm run format` | Format changed files with oxfmt. |

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8443` | Development and preview port. |
| `FIGMA_DEV_SERVER_HOST` | `0.0.0.0` | Host the dev server binds to. |
| `FIGMA_PUBLIC_URL` | `/` | Base path when deploying under a subpath. |

## Usage

1. **Add a purchase** — select *New record*, enter the product details and warranty
   length, then save. It appears in the register with its expiry date and status.
2. **Scan a receipt** — open the scanner and use the camera, choose an image, drop one in,
   or paste from the clipboard. Check the recognised product, date, price and warranty
   before saving.
3. **Review your cover** — use the filters and the stat band to see what is still covered,
   what expires soon and what has lapsed.
4. **Find a receipt** — open the archive to browse purchases by month, search for a record
   and check whether its receipt is on file.
5. **Change language** — use the language selector in the header.

Records created in the app are saved in the browser and persist across reloads. Clearing
site data removes them and restores the sample register.

## Project structure

```
src/
├─ components/   Reusable UI (header, stats, receipt cards, progress, dialogs)
├─ pages/        Register and Archive screens
├─ domain/       Item model, warranty calculations, seed data, storage repository
├─ stats/        Price and warranty statistics
├─ scan/         OCR engine, worker, receipt parser and scanner dialog
├─ i18n/         Language provider and EN/RU/KK dictionaries
├─ lib/          Formatters and small shared helpers
├─ App.tsx       Application shell and shared state
└─ index.css     Design tokens and shared styles
```

## Privacy

- Records are stored only in your browser's `localStorage`.
- Receipt images are processed on-device and are never uploaded.
- The only network request is the one-time model download during setup.
- No analytics, tracking or third-party services are used.

## Limitations

- Receipt recognition supports Latin-script (English) receipts; the interface is fully
  translated, but the OCR vocabulary is English-only.
- Data lives on a single device and is not synchronised between browsers.
- Prices are recorded in GBP and displayed with locale-aware digit grouping.
