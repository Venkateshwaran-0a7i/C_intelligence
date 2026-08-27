# GptModel — Product Intelligence & OCR Extraction

A Python CLI application that analyzes product packaging images using **OpenAI's GPT-4o-mini Vision API** and returns fully structured product intelligence JSON.

---

## Features

- **Multi-image fusion** — Combine front, back, side, and nutrition panels into one record
- **Internal OCR** — Extracts all text from labels, tables, barcodes, and small print
- **Conflict resolution** — Priority-based merging (nutrition panel > ingredients > back label > front label)
- **Confidence scoring** — Every extracted field gets `High / Medium / Low` confidence
- **Pydantic validation** — Output is validated against a strict schema before returning
- **Rich CLI** — Colored, syntax-highlighted terminal output

---

## Setup

### 1. Install dependencies

```bash
uv sync
```

### 2. Configure API key

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

Or export it directly:

```bash
export OPENAI_API_KEY="your_key_here"
```

---

## Usage

### Basic usage

```bash
uv run main.py --images front.jpg
```

### Multiple images (different views of the same product)

```bash
uv run main.py --images front.jpg back.jpg side.jpg nutrition.jpg
```

### Save output to a file

```bash
uv run main.py --images front.jpg back.jpg --output result.json
```

### Use a different model

```bash
uv run main.py --images img.jpg --model gpt-4o
```

### All options

```
--images IMAGE [IMAGE ...]   One or more image paths (JPEG, PNG, WEBP, GIF)
--output FILE, -o FILE       Optional path to save JSON output
--model MODEL                OpenAI model (default: gpt-4o-mini)
--temperature FLOAT          Model temperature (default: 0.0)
--indent N                   JSON indentation spaces (default: 2)
--no-color                   Disable colored output
```

---

## Output Schema

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

## Project Structure

```
GptModel/
├── main.py              # CLI entry point
├── src/
│   ├── __init__.py
│   ├── extractor.py     # OpenAI Vision API + image encoding
│   ├── models.py        # Pydantic output schema
│   └── prompt.py        # System prompt + extraction rules
├── .env.example         # API key template
├── pyproject.toml       # Project dependencies
└── README.md
```

---

## Supported Image Formats

| Format | Extension        |
|--------|-----------------|
| JPEG   | `.jpg`, `.jpeg` |
| PNG    | `.png`          |
| WEBP   | `.webp`         |
| GIF    | `.gif`          |

---

## Requirements

- Python 3.11+
- OpenAI API key with GPT-4o or GPT-4o-mini access
