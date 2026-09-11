# GptModel — Product Intelligence & OCR Extraction

> **AI-powered product packaging analysis with LIMS integration** — Extract structured product data from images, match against a product catalogue, and link with Laboratory Information Management System (LIMS) samples, all through a FastAPI REST API + CLI.

---

## 📌 Overview

**GptModel** is a full-stack, AI-driven **Product Intelligence** platform built for competition analysis and quality control workflows. It processes one or more product packaging images, runs OCR and semantic extraction via **OpenAI's Vision API (GPT-4o / GPT-5-mini)**, and returns fully validated, structured JSON.

The extracted data flows through a multi-step pipeline:

```
Product Images
     │
     ▼
┌──────────────┐
│  /extract    │  ← Vision AI extracts 30+ fields from packaging
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ /products/match  │  ← Weighted scoring against product catalogue (MongoDB)
└──────┬───────────┘
       │
       ▼
┌──────────────────────┐
│ /products/confirm    │  ← Human confirms: link existing or create new
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────┐
│ /product-data/{id}/lims      │  ← Attach LIMS sample result (lims_sc_value)
└──────────────────────────────┘
```

### Key Capabilities

| Feature | Description |
|---|---|
| 🖼️ **Multi-image fusion** | Combine front, back, side & nutrition panel into one record |
| 🔍 **Internal OCR** | Extracts all text: labels, tables, barcodes, fine print |
| ⚖️ **Conflict resolution** | Priority-based merging (nutrition panel > ingredients > back > front) |
| 📊 **Confidence scoring** | Every extracted field gets `High / Medium / Low` confidence |
| ✅ **Pydantic validation** | Output validated against a strict schema before returning |
| 🗄️ **MongoDB + GridFS** | Images stored in GridFS; product data persisted in collections |
| 🔗 **LIMS integration** | Link scanned products to LIMS sample records |
| 🎨 **Rich CLI** | Colored, syntax-highlighted terminal output with status spinner |
| 🌐 **FastAPI REST API** | Fully documented interactive API (Swagger UI at `/docs`) |

---

## 🗂️ Project Structure

```
GptModel/
├── main.py                  # FastAPI app + CLI entry point
├── src/
│   ├── __init__.py
│   ├── extractor.py         # OpenAI Vision API call + image encoding (base64)
│   ├── models.py            # Pydantic output schema (30+ fields)
│   ├── prompt.py            # System prompt + structured extraction rules
│   └── db.py                # MongoDB / GridFS helpers (CRUD + LIMS joins)
├── frontend/                # React + Vite frontend (TypeScript)
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── app/                     # Reserved for additional app modules
├── .env.example             # Environment variable template
├── .env                     # Your local env (not committed)
├── pyproject.toml           # Python project metadata & dependencies (uv)
├── uv.lock                  # Locked dependency versions
└── README.md
```

---

## ⚙️ Setup & Installation

### Prerequisites

- **Python 3.11+**
- **[uv](https://docs.astral.sh/uv/)** — fast Python package manager (`pip install uv`)
- **MongoDB** (local or Atlas) with access to the `Competition_intelligence` database
- **OpenAI API Key** with GPT-4o / GPT-4o-mini / GPT-5-mini access
- **Node.js 18+** (only for frontend development)

---

### 1. Clone the repository

```bash
git clone https://github.com/brindavathy/cc_lims.git
cd cc_lims
```

### 2. Install Python dependencies

```bash
uv sync
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Then edit `.env` with your values:

```env
# Required
OPENAI_API_KEY=sk-...your-openai-key-here...

# Optional: use a custom gateway (e.g., Azure OpenAI, LiteLLM proxy)
OPENAI_BASE_URL=https://api.openai.com

# MongoDB connection (defaults shown)
MONGO_URI=mongodb://localhost:27017
MONGO_DB=Competition_intelligence
MONGO_COLLECTION=Product_data
```

### 4. (Optional) Install frontend dependencies

```bash
cd frontend
npm install
```

---

## 🚀 Running the Project

### Option A — API Server (FastAPI + Uvicorn)

Start the backend REST API server:

```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at:
- **Swagger UI (interactive docs):** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health check:** http://localhost:8000/health

### Option B — CLI (Command-Line Interface)

Analyze product images directly from the terminal:

```bash
# Basic usage — single image
uv run main.py --images front.jpg

# Multiple images (different views of the same product)
uv run main.py --images front.jpg back.jpg side.jpg nutrition.jpg

# Save output to a JSON file
uv run main.py --images front.jpg back.jpg --output result.json

# Use a different model
uv run main.py --images img.jpg --model gpt-4o

# Use a specific temperature (default: 1)
uv run main.py --images img.jpg --temperature 1

# Disable colored terminal output
uv run main.py --images img.jpg --no-color
```

### Option C — Frontend Dev Server

```bash
cd frontend
npm run dev
```

The React app will be available at http://localhost:5173

---

## 📋 CLI Reference

```
usage: gptmodel [-h] --images IMAGE [IMAGE ...] [--output FILE] [--model MODEL]
                [--temperature FLOAT] [--indent N] [--no-color]

Options:
  --images IMAGE [IMAGE ...]   One or more image paths (JPEG, PNG, WEBP, GIF) [required]
  --output FILE, -o FILE       Path to save JSON output (e.g. result.json)
  --model MODEL                OpenAI model to use (default: gpt-5-mini)
  --temperature FLOAT          Model temperature; GPT-5 models only support 1 (default: 1)
  --indent N                   JSON indentation spaces (default: 2)
  --no-color                   Disable colored terminal output
  -h, --help                   Show this help message and exit
```

---

## 🌐 API Reference

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Check API key, gateway config & model status |

### Extraction

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/extract` | Upload images → run extraction → store in `product_data` |
| `GET` | `/images/{image_id}` | Retrieve a stored product image from GridFS |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/products` | List all products (paginated, with filters) |
| `GET` | `/products/match` | Weighted candidate scoring — recommendation only |
| `POST` | `/products/confirm` | Human confirms: `link` existing or `create_new` |
| `GET` | `/products/{product_id}` | Full product detail + latest scan + LIMS data |
| `GET` | `/products/{product_id}/history` | Scan timeline (lightweight or `?expand=true`) |

### LIMS

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/lims/search` | Free-text search of LIMS samples — recommendation only |
| `POST` | `/product-data/{id}/lims` | Attach a validated LIMS sample to a scan |

---

## 📦 Output Schema

Every successful extraction returns a JSON object with the following structure:

```json
{
  "product_name":   { "value": "...", "confidence": "High" },
  "brand":          { "value": "...", "confidence": "High" },
  "category":       { "value": "...", "confidence": "Medium" },
  "subcategory":    { "value": "...", "confidence": "Medium" },
  "variant":        { "value": "...", "confidence": "High" },
  "sku":            { "value": "...", "confidence": "Low" },
  "package_type":   { "value": "...", "confidence": "High" },
  "net_quantity":   { "value": "...", "confidence": "High" },
  "grammage":       { "value": "...", "confidence": "High" },
  "serving_size":   { "value": "...", "confidence": "High" },
  "front_claims":   ["High Protein", "Gluten Free"],
  "back_claims":    ["No Added Sugar"],
  "ingredients":    ["Ingredient 1", "Ingredient 2"],
  "allergens":      ["Contains: Milk, Soy"],
  "nutrition": {
    "Energy": { "per_serving": "200", "per_100g": "400", "unit": "kcal", "confidence": "High" }
  },
  "manufacturer": {
    "name": "...", "address": "...", "country_of_origin": "...",
    "website": "...", "email": "...", "phone": "..."
  },
  "manufacturing_information": {
    "batch_number": "...", "manufacturing_date": "...",
    "expiry_date": "...", "best_before": "..."
  },
  "storage_instructions": "...",
  "preparation_instructions": "...",
  "usage_instructions": "...",
  "certifications": ["FSSAI", "ISO 22000"],
  "warnings": ["Contains allergens"],
  "package_contents": ["1 x Product"],
  "barcode": "1234567890123",
  "mrp": "₹ 299",
  "summary": "..."
}
```

---

## 🖼️ Supported Image Formats

| Format | Extensions |
|--------|------------|
| JPEG | `.jpg`, `.jpeg` |
| PNG | `.png` |
| WEBP | `.webp` |
| GIF | `.gif` |

---

## 🔧 Dependencies

| Package | Purpose |
|---------|---------|
| `fastapi` | REST API framework |
| `uvicorn` | ASGI server |
| `openai` | OpenAI Vision API client |
| `pydantic` | Data validation & schema |
| `pymongo` | MongoDB driver (GridFS + collections) |
| `python-dotenv` | Load `.env` configuration |
| `python-multipart` | Multipart file upload support |
| `pillow` | Image processing utilities |
| `rich` | Colored CLI output & spinners |

---

## 🗄️ MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `product_data` | Raw extraction results per scan (immutable) |
| `product_info` | De-duplicated product catalogue with scan history |
| `lims_sc` | LIMS sample records |
| `lims_pg` | LIMS parameter group definitions |
| `lims_pa` | LIMS parameter analysis results |
| GridFS (`fs.*`) | Binary image storage |

---

## 🧪 Example Workflow

```bash
# 1. Start the API server
uv run uvicorn main:app --reload

# 2. Extract product data from images (via curl)
curl -X POST http://localhost:8000/extract \
  -F "images=@front.jpg" \
  -F "images=@back.jpg" \
  -F "model=gpt-4o-mini"

# 3. Match against product catalogue
curl "http://localhost:8000/products/match?product_name=Protein+Bar&brand=XYZ"

# 4. Confirm product (link or create new)
curl -X POST http://localhost:8000/products/confirm \
  -H "Content-Type: application/json" \
  -d '{"product_data_id": "...", "action": "create_new", "confirmed_by": "user@example.com"}'

# 5. Search LIMS samples
curl "http://localhost:8000/lims/search?q=protein+chocolate"

# 6. Attach LIMS sample to the scan
curl -X POST http://localhost:8000/product-data/{product_data_id}/lims \
  -H "Content-Type: application/json" \
  -d '{"product_id": "...", "lims_sc_value": "SC-2024-001", "confirmed_by": "user@example.com"}'
```

---

## 📋 Requirements

- Python **3.11+**
- OpenAI API key with **GPT-4o**, **GPT-4o-mini**, or **GPT-5-mini** access
- MongoDB **4.4+** (local or Atlas)
- `uv` package manager

---

## 📄 License

This project is part of the **C_intelligence** internal tooling suite.
