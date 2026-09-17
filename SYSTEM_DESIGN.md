# GptModel — System Design & Workflow

> AI-powered **Product Intelligence & OCR Extraction** platform with LIMS
> integration. Extracts structured product data from packaging images,
> auto-matches against a catalogue, links laboratory samples, and enables
> frozen multi-brand comparisons.

---

## 1. Overview

GptModel is a full-stack product-intelligence system:

- **Backend** — FastAPI REST API (`main.py`) + extraction engine (`src/extractor.py`),
  prompt/schema rules (`src/prompt.py`), and the MongoDB storage layer (`src/db.py`).
- **Frontend** — React 19 + Vite + TypeScript SPA (`frontend/`) with four routes:
  Products, Upload, LIMS, and Product Detail.
- **AI Core** — OpenAI Vision (GPT-5-mini / GPT-4o) performs OCR + semantic
  extraction on one or more packaging images fused into one product record.
- **Storage** — MongoDB with two logical databases (`Competition_intelligence`
  + read-only `lims`) and GridFS for binary images.

---

## 2. Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (React 19 + Vite + Tailwind, port 5173)               │
│  App.tsx routes:  "/" Products · "/upload" · "/lims" ·           │
│                   "/products/:productId"                         │
│  lib/api.ts   = typed fetch client → FastAPI (port 8000)         │
└────────────────────────────────────┬─────────────────────────────┘
                                     │ HTTP/JSON + multipart upload
┌────────────────────────────────────▼─────────────────────────────┐
│  BACKEND (FastAPI — main.py)                                     │
│  /extract · /products* · /lims* · /competitions* · /images/{id}  │
└────────────────────────────────────┬─────────────────────────────┘
              ┌──────────────┬───────┴───────┬──────────────┐
              ▼              ▼               ▼              ▼
┌─────────────────┐ ┌──────────────┐ ┌───────────────┐ ┌────────────┐
│ src/extractor.py │ │ src/db.py     │ │ src/prompt.py │ │ GridFS     │
│ OpenAI Vision    │ │ Mongo storage │ │ system prompt │ │ images     │
│ base64 → JSON    │ │ + LIMS joins  │ │ + 30+ schema  │ │ fs.*       │
└────────┬────────┘ └──────┬───────┘ └───────────────┘ └────────────┘
         │                 │
         ▼                 ▼
   OpenAI gateway    MongoDB (2 DBs)
   (OPENAI_BASE_URL) ─ Competition_intelligence + lims
```

### 2.1 Data stores

**`Competition_intelligence` database**

| Collection | Purpose |
|---|---|
| `product_data` | Immutable, append-only extraction snapshots — one per upload/scan |
| `product_info` | Deduplicated product catalogue — one document per real product, tracks `scan_history` |
| `competition_sessions` | Frozen multi-brand comparison sessions (2–4 products) |
| `fs.files` / `fs.chunks` | GridFS binary image storage |

**`lims` database (read-only)**

| Collection | Purpose |
|---|---|
| `lims_sc` | LIMS sample cards (sample containers) |
| `lims_pg` | LIMS parameter group definitions (label lookup) |
| `lims_pa` | LIMS parameter analysis / test results (authoritative) |

---

## 3. End-to-End Workflow

1. **Upload** — `UploadPage` sends one or more packaging images as
   `multipart/form-data` to `POST /extract` (`main.py:198`).
2. **AI extraction** — `src/extractor.py` base64-encodes every image, builds the
   multimodal payload from the master prompt (`src/prompt.py`), calls OpenAI with
   `response_format=json_object`, and returns validated structured JSON
   (`extractor.py:98`). GPT-5 models force `temperature=1`.
3. **Persist images** — each image stored in GridFS via `save_image()` (`db.py:146`).
4. **Persist scan** — immutable row appended to `product_data` via
   `save_product_data()` (`db.py:199`).
5. **Auto link / create** — `auto_link_or_create_product()` (`db.py:394`) runs
   weighted scoring against `product_info`. Top candidate ≥ 70 → **link**, else
   **create new**. Auto actions are audited with `confirmed_by="system-auto"`.
6. **Manual LIMS link** *(optional)* — `LimsSearchModal` loads all samples from
   `/lims/list` (filtered client-side); picking one calls
   `POST /product-data/{id}/lims`, which validates the `sc_value` against
   `lims_sc` and writes it into the matching `scan_history` entry (`db.py:715`).
7. **Inspect** — Product list (`/products`) is paginated and deduplicated
   (one row per product); Product detail (`/products/{id}`) joins the latest
   scan + compiled LIMS results (`lims_sc → lims_pg → lims_pa`);
   Timeline (`/products/{id}/history?expand=true`) inlines full scan data.
8. **Competition sessions** *(optional)* — 2–4 products are frozen at creation
   time into `competition_sessions`; the saved snapshots never drift when new
   scans arrive.

---

## 4. Flow Chart

```mermaid
flowchart TD
    A[User uploads product images] --> B[POST /extract]
    B --> C[base64 encode + build vision payload]
    C --> D[OpenAI Vision API · gpt-5-mini]
    D --> E[Parse validated JSON]
    E --> F[save images → GridFS]
    E --> G[save immutable scan → product_data]
    G --> H{auto_link_or_create_product}
    H -->|score ≥ 70| I[find_product_candidates weighted scoring]
    I --> J[LINK → push scan_history to existing product_info]
    H -->|score < 70 or none| K[CREATE NEW product_info doc]
    J --> L{Link LIMS sample?}
    K --> L
    L -->|yes| M[GET /lims/list → pick sc_value]
    M --> N[POST /product-data/{id}/lims · validate in lims_sc]
    L -->|no / skip| O[Product catalog]
    N --> O
    O --> P[Product list · detail · timeline]
    P --> Q[Competition session?]
    Q -->|yes 2-4 products| R[Freeze snapshots → competition_sessions]
    Q -->|no| S[Done]
    R --> S
```

ASCII equivalent:

```

Images ─▶ /extract ─▶ OpenAI Vision OCR ─▶ validated JSON
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
              GridFS (images)              product_data (scan, immutable)
                                                     │
                                          auto-link-or-create
                                              │         │
                                      score≥70 ┌┘┌ score<70
                                         LINK  │  │  CREATE_NEW
                                              ▼  ▼
                                        product_info (deduped)
                                                     │
                                  LIMS link? ──no──▶ skip
                                     │yes
                                     ▼
                          /lims/list → pick sample
                                     │
                                     ▼
                      /product-data/{id}/lims (validated)
                                     │
                                     ▼
                      Product list / detail / timeline (LIMS joined)
                                     │
                     ──▶ Competition session (2–4 frozen snapshots)
```

---

## 5. System Design Details

### 5.1 Extraction layer (`src/extractor.py`, `src/prompt.py`)

- Master prompt treats **all uploaded images as different views of ONE product**.
- Pipeline enforced by the prompt: OCR → text extraction → multi-image fusion →
  dedup → conflict resolution → field normalization → structured JSON.
- Conflict-resolution priority: nutrition > ingredients > manufacturing >
  regulatory > back > side > front > marketing creatives.
- Normalization rules: units (`340ML → 340 ml`), dates (`YYYY-MM-DD`), currency.
- Strict extraction: no guessing/hallucination; placeholders `"Not Available"`,
  `[]`, `{}`; every field gets `High | Medium | Low` confidence.
- `response_format=json_object`, `max_tokens=8192`; markdown fences are stripped
  and `extracted_at` (UTC ISO) is injected.

### 5.2 Storage & matching layer (`src/db.py`)

- **Best-effort persistence** — MongoDB being down never fails the extraction;
  `save_product_data()` logs a warning and returns `None`.
- **Weighted candidate scoring** (in-application, not text search):

  | Field | Exact | Substring | Mismatch |
  |---|---|---|---|
  | Barcode | +50 | — | — |
  | Product name | +40 | +20 | — |
  | Brand | +30 | +15 | — |
  | Variant | +15 | +5 | −40 |
  | Net quantity | +15 | — | −20 |

  Thresholds: ≥ 30 → candidate list; ≥ 70 → auto-link.
- `product_info` stores normalized fields for stable matching,
  `first_uploaded_image` (GridFS id), and `scan_history` (audit trail:
  `product_data_id`, `analyzed_at`, `lims_sc_value`, `confirmed_by`).
- **LIMS join** is driven by `lims_pa` (authoritative test results); `lims_pg`
  is only used to label parameter groups. The join key is `additional_data.SC`
  from `lims_sc`.

### 5.3 API surface (`main.py`)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Gateway / API-key status |
| `POST` | `/extract` | Full pipeline: extract + persist + auto link/create |
| `GET` | `/images/{image_id}` | GridFS image retrieval |
| `GET` | `/products` | Paginated catalogue with filters (single list source) |
| `GET` | `/products/match` | Weighted candidate scoring — recommendation only |
| `POST` | `/products/confirm` | Manual `link` or `create_new` |
| `GET` | `/products/{product_id}` | Detail + latest scan + compiled LIMS |
| `GET` | `/products/{product_id}/history?expand=` | Scan timeline (lightweight or raw-expanded) |
| `GET` | `/lims/list` | Full LIMS sample list (client-side filtering) |
| `GET` | `/lims/admin` | Sample cards + linked-product counts |
| `POST` | `/product-data/{id}/lims` | Attach validated LIMS sample to a scan |
| `POST` | `/competitions` | Create frozen 2–4 product comparison |
| `GET` | `/competitions` | List sessions |
| `GET` | `/competitions/{session_id}` | Session detail + hydrated snapshots |

### 5.4 Frontend (`frontend/`)

- **Pages**: `ProductListPage` (server-side filters + pagination, client-side
  page search), `UploadPage` (extract → auto-link banner → optional LIMS link),
  `ProductDetailPage` (Details / Lab results / Timeline tabs),
  `LimsAdminPage` (sample-card registry with linked-product counts).
- `lib/api.ts` is a typed fetch client; base URL from `VITE_API_URL`
  (defaults to `http://localhost:8000`).
- LIMS search is fully client-side over the full `/lims/list` response
  (no per-keystroke requests).

### 5.5 Configuration

`.env` keys: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `MONGO_URI`, `MONGO_DB`,
`MONGO_COLLECTION` (+ LIMS collection names, MONGO timeout); frontend uses
`VITE_API_URL`. A `scripts/migrate_storage_structure.py` backfills legacy
`product_info` documents and creates `competition_sessions` + indexes.

### 5.6 Run modes

- **API**: `uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
- **CLI**: `uv run main.py --images front.jpg back.jpg --output result.json`
  (shares the same `extract_product_data()` path, persists best-effort)
- **Frontend**: `cd frontend && npm run dev` (port 5173; `/api` proxied to 8000)

---

## 6. Key Design Decisions

1. **Immutability** — scans (`product_data`) are append-only; edits only mutate
   the `product_info` catalogue index.
2. **Auto-link with auditability** — system decisions are recorded
   (`confirmed_by`, `match_score`) so humans can review the trail.
3. **Manual LIMS linking** — never inferred; validated against `lims_sc` on write.
4. **Frozen competition snapshots** — comparisons don't secretly change as new
   scans arrive; `snapshot_ids` are resolved at creation.
5. **Graceful degradation** — extraction survives DB/API outages; errors are
   mapped to meaningful HTTP responses (`_openai_error_response`).
6. **Simplified matching** — catalogue-level scoring instead of full-text search
   keeps `product_info` small (one row per real product).

---

## 7. Diagram Image

`docs/flowchart.png` — rendered Mermaid flowchart of the end-to-end pipeline
(generated with `@mermaid-js/mermaid-cli`).