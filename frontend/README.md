# GptModel Frontend

React 18 + TypeScript + Vite + Tailwind CSS 4 web app for the GptModel FastAPI
backend (Extract → Recommend → Confirm → Store pipeline).

## Pages

- **`/`** — Product catalog as a responsive card grid with filters
  (business, division, brand, own/competitor) and pagination.
- **`/products/:productId`** — Product detail with three tabs:
  **Details** (identification, claims, ingredients, nutrition, manufacturer,
  manufacturing dates + MRP with confidence badges), **Lab results (LIMS)**,
  and **Timeline** (expanded scan history).
- **`/upload`** — Upload product packaging images, extract data, review ranked
  match candidates, then link to an existing product or create a new one.

## Prerequisites

- Node.js 20+ (built and tested with Node 24)
- The FastAPI backend running on `http://localhost:8000`

## Setup

```bash
cd frontend
npm install

# Optional: point at a different backend
cp .env.example .env
# edit VITE_API_BASE_URL (defaults to http://localhost:8000)
```

## Run (dev)

```bash
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:8000` in dev, so
you can leave `VITE_API_BASE_URL` unset and still hit the backend without CORS
in the browser.

## Build

```bash
npm run build   # tsc + vite — must produce zero TypeScript errors
npm run preview
```

## CORS configuration (FastAPI backend)

The frontend calls the backend directly at `http://localhost:8000`, so the
FastAPI app **must** have CORS configured for the Vite dev origin. Add this
immediately after `app = FastAPI(...)` in `main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Without this, every `GET`/`POST` that sends a JSON `Content-Type` header
triggers a browser preflight `OPTIONS` request that FastAPI rejects by default.

**Heads-up:** `POST /extract` uses `multipart/form-data`, which does **not**
trigger a preflight — so uploads can "work" even when CORS is broken for every
other endpoint. Don't use `/extract` succeeding as evidence that CORS is
configured correctly.

## API client

All backend calls live in `src/lib/api.ts`. Base URL comes from
`import.meta.env.VITE_API_BASE_URL` (default `http://localhost:8000`). No
components call `fetch()` directly.

## Design tokens

- Paper-white background `#FAF9F6`, ink text `#1B2420`
- Teal = confirmed / linked / positive states
- Amber = low-confidence / needs-review states
- Confidence badges (High / Medium / Low) shown next to every scored field
- Monospace fonts for identifiers that must be read exactly
  (barcodes, batch numbers, `sc_value`)