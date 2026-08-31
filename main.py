"""
GptModel — Product Intelligence & OCR Extraction API + CLI

Usage (CLI)
-----------
    uv run main.py --images front.jpg back.jpg side.jpg
    uv run main.py --images product.png --output result.json
    uv run main.py --images img.jpg --model gpt-4o --output out.json

API Endpoints
-------------
    GET  /health
    POST /extract
    GET  /images/{image_id}

    GET  /products/match            → scored candidate list (recommendation only)
    POST /products/confirm          → link or create_new
    GET  /lims/search               → free-text LIMS sample search (recommendation only)
    POST /product-data/{id}/lims    → attach LIMS sc_value to a scan
    GET  /products                  → paginated product list
    GET  /products/{product_id}     → full product detail + latest scan + LIMS
    GET  /products/{product_id}/history → scan timeline (lightweight or expanded)
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Optional

import openai
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel
from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax

# Load .env file if present (picks up OPENAI_API_KEY + OPENAI_BASE_URL)
load_dotenv()

console = Console()

DEFAULT_MODEL = "gpt-5-mini"

app = FastAPI(
    title="GptModel — Product Intelligence API",
    version="2.0.0",
    description=(
        "Extract → Recommend → Confirm → Store pipeline for product packaging "
        "intelligence with LIMS integration."
    ),
)


# ── Pydantic request bodies ──────────────────────────────────────────────────

class ConfirmProductBody(BaseModel):
    product_data_id: str
    action: str  # "link" | "create_new"
    product_id: Optional[str] = None
    confirmed_by: str


class LinkLimsBody(BaseModel):
    product_id: str
    lims_sc_value: str
    confirmed_by: str


# ── Utility ─────────────────────────────────────────────────────────────────

def _gateway_base_url() -> Optional[str]:
    return os.environ.get("OPENAI_BASE_URL") or None


def _openai_error_response(exc: Exception, base_url: Optional[str], model: str = "") -> HTTPException:
    """Map common OpenAI errors to FastAPI HTTPExceptions."""
    if isinstance(exc, openai.AuthenticationError):
        return HTTPException(
            status_code=401,
            detail={
                "error": "Authentication failed",
                "message": "Invalid or missing OPENAI_API_KEY.",
                "gateway": base_url or "https://api.openai.com",
            },
        )
    if isinstance(exc, openai.PermissionDeniedError):
        return HTTPException(
            status_code=403,
            detail={
                "error": "Permission denied (403 from gateway)",
                "message": (
                    "The gateway rejected the request. Possible causes: "
                    "invalid API key, unsupported model name, or IP not whitelisted."
                ),
                "gateway": base_url or "https://api.openai.com",
                "model": model,
            },
        )
    if isinstance(exc, openai.NotFoundError):
        return HTTPException(
            status_code=404,
            detail={
                "error": "Model not found",
                "message": f"The model '{model}' was not found on the gateway.",
                "gateway": base_url or "https://api.openai.com",
                "model": model,
                "hint": "Check that the model name is supported by your gateway (e.g. gpt-4o-mini).",
            },
        )
    if isinstance(exc, openai.RateLimitError):
        return HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "message": "Too many requests. Please slow down or upgrade your plan.",
                "gateway": base_url or "https://api.openai.com",
            },
        )
    if isinstance(exc, openai.APIStatusError):
        raw_body = exc.response.text if hasattr(exc, "response") else str(exc)
        is_html = raw_body.strip().startswith("<")
        return HTTPException(
            status_code=exc.status_code,
            detail={
                "error": f"Gateway error (HTTP {exc.status_code})",
                "message": "The gateway returned an error. See 'raw_body' for details." if is_html else raw_body,
                "raw_body": raw_body if is_html else None,
                "gateway": base_url or "https://api.openai.com",
                "model": model,
            },
        )
    if isinstance(exc, openai.APIConnectionError):
        return HTTPException(
            status_code=502,
            detail={
                "error": "Cannot connect to gateway",
                "message": str(exc),
                "gateway": base_url or "https://api.openai.com",
            },
        )
    return HTTPException(
        status_code=500,
        detail={"error": type(exc).__name__, "message": str(exc)},
    )


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    """Check gateway configuration and API key status."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    base_url_raw = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com")
    base_url_normalized = base_url_raw.rstrip("/")
    if not base_url_normalized.endswith("/v1"):
        base_url_normalized = f"{base_url_normalized}/v1"
    return {
        "status": "ok",
        "gateway_raw": base_url_raw,
        "gateway_effective": base_url_normalized,
        "default_model": DEFAULT_MODEL,
        "api_key_set": bool(api_key),
        "api_key_preview": f"{api_key[:8]}…" if len(api_key) > 8 else "(not set)",
    }


# ── 1. POST /extract ─────────────────────────────────────────────────────────

@app.post("/extract", tags=["Extraction"])
async def extract(
    images: list[UploadFile] = File(...),
    model: str = Form(DEFAULT_MODEL),
    temperature: float = Form(1),
):
    """
    Upload product images → run extraction pipeline → store in product_data.

    Returns ``{product_data_id, analyzed_at, extracted_json}``.
    The product_data document is immutable after creation.
    No product matching or LIMS linking happens here.
    """
    from src.extractor import extract_product_data

    base_url = _gateway_base_url()
    tmp_dir = tempfile.mkdtemp()
    saved_paths: list[Path] = []
    image_payloads: list[tuple[str, str, bytes]] = []

    try:
        for upload in images:
            ext = Path(upload.filename or "img.jpg").suffix or ".jpg"
            tmp_path = Path(tmp_dir) / f"img_{len(saved_paths)}{ext}"
            content = await upload.read()
            tmp_path.write_bytes(content)
            saved_paths.append(tmp_path)
            image_payloads.append(
                (upload.filename or tmp_path.name, upload.content_type or "image/jpeg", content)
            )

        result = extract_product_data(
            image_paths=saved_paths,
            model=model,
            base_url=base_url,
            temperature=temperature,
        )

        # ── Persist images to GridFS ─────────────────────────────────────────
        from src.db import save_image, save_product_data

        image_refs, image_ids = [], []
        for filename, content_type, content in image_payloads:
            gridfs_id = save_image(content, filename, content_type)
            if gridfs_id:
                image_ids.append(gridfs_id)
                image_refs.append({
                    "filename": filename,
                    "content_type": content_type,
                    "size": len(content),
                    "gridfs_id": gridfs_id,
                })

        # ── Persist extraction to product_data ───────────────────────────────
        saved = save_product_data(
            result,
            model=model,
            image_filenames=[filename for filename, _, _ in image_payloads],
            source="api",
            image_refs=image_refs or None,
        )

        response: dict = {"extracted_json": result}
        if saved:
            product_data_id, analyzed_at = saved
            response["product_data_id"] = product_data_id
            response["analyzed_at"] = analyzed_at
        if image_ids:
            response["image_ids"] = image_ids

        return response

    except (FileNotFoundError, ValueError) as exc:
        status = 404 if isinstance(exc, FileNotFoundError) else 422
        raise HTTPException(status_code=status, detail=str(exc))
    except openai.OpenAIError as exc:
        raise _openai_error_response(exc, base_url, model)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": type(exc).__name__, "message": str(exc)})
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Image retrieval (unchanged) ───────────────────────────────────────────────

@app.get("/images/{image_id}", tags=["Images"])
async def get_image(image_id: str):
    """Retrieve a stored product image from MongoDB GridFS by its id."""
    from src.db import get_image as fetch_image

    stored = fetch_image(image_id)
    if stored is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Image not found", "image_id": image_id},
        )
    return Response(
        content=stored["data"],
        media_type=stored["content_type"],
        headers={"Content-Disposition": f'inline; filename="{stored["filename"]}"'},
    )


# ── 2. GET /products/match ────────────────────────────────────────────────────

@app.get("/products/match", tags=["Products"])
async def match_products(
    product_name: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    variant: Optional[str] = Query(None),
    net_quantity: Optional[str] = Query(None),
    barcode: Optional[str] = Query(None),
):
    """
    Search product_info for candidate matches using weighted scoring.

    Scoring:
        barcode exact:       +50
        brand exact:         +30  | substring: +15
        name exact:          +40  | substring: +20
        variant exact:       +15  | substring: +5
        variant mismatch:    -40
        net_quantity exact:  +15

    Returns all candidates scoring >= 30, sorted by score descending.
    **Recommendation only** — does not auto-link anything.
    """
    from src.db import find_product_candidates

    candidates = find_product_candidates(
        product_name=product_name,
        brand=brand,
        variant=variant,
        net_quantity=net_quantity,
        barcode=barcode,
    )
    return {"candidates": candidates, "count": len(candidates)}


# ── 3. POST /products/confirm ─────────────────────────────────────────────────

@app.post("/products/confirm", tags=["Products"])
async def confirm_product(body: ConfirmProductBody):
    """
    Confirm a product match.

    - ``action="link"``: append a new scan_history entry to an existing product_info document.
    - ``action="create_new"``: create a new product_info document from the extracted identity fields.

    Either way, lims_sc_value starts as null — it is attached later via
    ``POST /product-data/{id}/lims``.
    """
    from src.db import confirm_product_match

    if body.action not in ("link", "create_new"):
        raise HTTPException(
            status_code=422,
            detail=f"action must be 'link' or 'create_new', got {body.action!r}",
        )
    if body.action == "link" and not body.product_id:
        raise HTTPException(
            status_code=422,
            detail="product_id is required when action is 'link'",
        )

    try:
        result = confirm_product_match(
            product_data_id=body.product_data_id,
            action=body.action,
            confirmed_by=body.confirmed_by,
            product_id=body.product_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    if result is None:
        raise HTTPException(status_code=500, detail="Failed to confirm product match")

    return result


# ── 4. GET /lims/search ───────────────────────────────────────────────────────

@app.get("/lims/search", tags=["LIMS"])
async def lims_search(q: str = Query(..., description="Free-text search query")):
    """
    Search LIMS samples (lims_sc) by free text against the description field.

    Each token in the query is matched (case-insensitive regex) against description.
    Results are sorted by SAMPLING_DATE descending (latest first).
    Returns up to 50 results: {sc, sc_value, description, sampling_date}.

    **Recommendation only** — does not auto-link anything.
    """
    from src.db import search_lims_samples

    if not q.strip():
        raise HTTPException(status_code=422, detail="Query 'q' must not be empty")

    results = search_lims_samples(q)
    return {"results": results, "count": len(results)}


# ── 5. POST /product-data/{product_data_id}/lims ──────────────────────────────

@app.post("/product-data/{product_data_id}/lims", tags=["LIMS"])
async def attach_lims(product_data_id: str, body: LinkLimsBody):
    """
    Attach a validated LIMS sample to a specific scan in product_info.

    Validates that lims_sc_value exists in lims_sc.
    Updates the matching scan_history entry (matched by product_data_id)
    in the given product_info document.

    Returns the updated product_info document.
    """
    from src.db import link_lims_sample

    try:
        result = link_lims_sample(
            product_data_id=product_data_id,
            product_id=body.product_id,
            lims_sc_value=body.lims_sc_value,
            confirmed_by=body.confirmed_by,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    if result is None:
        raise HTTPException(status_code=500, detail="Failed to attach LIMS sample")

    return result


# ── 6. GET /products ──────────────────────────────────────────────────────────

@app.get("/products", tags=["Products"])
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    business: Optional[str] = Query(None),
    division: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    product_category: Optional[str] = Query(None),
    is_competitor: Optional[bool] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date string, filter on latest_analyzed_at"),
    date_to: Optional[str] = Query(None, description="ISO date string, filter on latest_analyzed_at"),
):
    """
    Return all product_info documents (paginated), each enriched with:
    - ``scan_count`` — number of scans for this product
    - ``latest_analyzed_at`` — timestamp of the most recent scan

    This is the **only** endpoint the frontend product list should call.
    Results are inherently deduplicated (one row per real-world product).
    """
    from src.db import list_products as db_list_products

    return db_list_products(
        page=page,
        page_size=page_size,
        business=business,
        division=division,
        brand=brand,
        product_category=product_category,
        is_competitor=is_competitor,
        date_from=date_from,
        date_to=date_to,
    )


# ── 7. GET /products/{product_id} ─────────────────────────────────────────────

@app.get("/products/{product_id}", tags=["Products"])
async def get_product(product_id: str):
    """
    Return a full product detail object:
    - The product_info document
    - The full product_data for the most recent scan (fetched on demand)
    - Compiled LIMS test results for that scan, if a lims_sc_value is attached
      (joined: lims_sc → lims_pg → lims_pa)
    """
    from src.db import get_product_detail

    try:
        result = get_product_detail(product_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Product not found", "product_id": product_id},
        )
    return result


# ── 8. GET /products/{product_id}/history ────────────────────────────────────

@app.get("/products/{product_id}/history", tags=["Products"])
async def get_product_history(
    product_id: str,
    expand: bool = Query(
        False,
        description=(
            "When true, inline the full product_data + LIMS results for every scan entry. "
            "No diffing is performed — raw data only."
        ),
    ),
):
    """
    Return the scan timeline for a product.

    By default returns a **lightweight** list of scan_history pointers
    (product_data_id, analyzed_at, lims_sc_value, confirmation fields)
    sorted by analyzed_at ascending.

    Use ``?expand=true`` to inline the full product_data and LIMS results
    per entry — no diffing, just raw data per scan.
    """
    from src.db import get_product_history as db_get_history

    try:
        history = db_get_history(product_id, expand=expand)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if history is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Product not found", "product_id": product_id},
        )
    return {"product_id": product_id, "expand": expand, "history": history}


# ── CLI entry point ───────────────────────────────────────────────────────────

def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="gptmodel",
        description=(
            "Product Intelligence & OCR Extraction AI.\n"
            "Analyzes product packaging images and returns structured JSON."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  uv run main.py --images front.jpg back.jpg
  uv run main.py --images product.png --output result.json
  uv run main.py --images img.jpg --model gpt-4o
        """,
    )
    parser.add_argument(
        "--images",
        nargs="+",
        required=True,
        metavar="IMAGE",
        help="One or more image file paths (JPEG, PNG, WEBP, GIF)",
    )
    parser.add_argument(
        "--output",
        "-o",
        metavar="FILE",
        default=None,
        help="Optional path to save JSON output (e.g. result.json)",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        metavar="MODEL",
        help=f"OpenAI model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=1,
        metavar="FLOAT",
        help="Model temperature — gpt-5 models only support 1 (default: 1)",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        metavar="N",
        help="JSON indentation spaces (default: 2)",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )
    return parser.parse_args(argv)


def print_header() -> None:
    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com")
    console.print(
        Panel.fit(
            "[bold cyan]GptModel[/bold cyan] — Product Intelligence & OCR Extraction\n"
            f"[dim]Gateway:[/dim] [yellow]{base_url}[/yellow]",
            border_style="cyan",
        )
    )


def print_image_list(image_paths: list[Path]) -> None:
    console.print("\n[bold]Images to process:[/bold]")
    for i, p in enumerate(image_paths, 1):
        size_kb = p.stat().st_size / 1024
        console.print(f"  [dim]{i}.[/dim] {p.name}  [dim]({size_kb:.1f} KB)[/dim]")
    console.print()


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        from src.extractor import extract_product_data
    except ImportError as exc:
        console.print(f"[red]Import error:[/red] {exc}")
        console.print(
            "[yellow]Tip:[/yellow] Run [bold]uv sync[/bold] to install dependencies."
        )
        return 1

    if args.no_color:
        console.no_color = True

    print_header()

    image_paths = [Path(p) for p in args.images]
    missing = [p for p in image_paths if not p.exists()]
    if missing:
        for p in missing:
            console.print(f"[red]✗ File not found:[/red] {p}")
        return 1

    print_image_list(image_paths)
    console.print(
        f"[bold]Model:[/bold] {args.model}  |  "
        f"[bold]Images:[/bold] {len(image_paths)}"
    )
    console.print()

    with console.status(
        "[bold cyan]Analyzing images and extracting product data…[/bold cyan]",
        spinner="dots",
    ):
        try:
            result = extract_product_data(
                image_paths=image_paths,
                model=args.model,
                base_url=os.environ.get("OPENAI_BASE_URL") or None,
                temperature=args.temperature,
            )
        except FileNotFoundError as exc:
            console.print(f"\n[red]File error:[/red] {exc}")
            return 1
        except ValueError as exc:
            console.print(f"\n[red]Extraction error:[/red] {exc}")
            return 1
        except Exception as exc:  # noqa: BLE001
            console.print(f"\n[red]Unexpected error:[/red] {exc}")
            return 1

    # ── Persist to MongoDB (best-effort) ─────────────────────────────────────
    from src.db import (
        MONGO_COLLECTION,
        MONGO_DB,
        PRODUCT_DATA_COLLECTION,
        save_image,
        save_product_data,
    )

    image_refs, image_ids = [], []
    for p in image_paths:
        mime = mimetypes.guess_type(str(p))[0] or "image/jpeg"
        gridfs_id = save_image(p.read_bytes(), p.name, mime)
        if gridfs_id:
            image_ids.append(gridfs_id)
            image_refs.append({
                "filename": p.name,
                "content_type": mime,
                "size": p.stat().st_size,
                "gridfs_id": gridfs_id,
            })

    saved = save_product_data(
        result,
        model=args.model,
        image_filenames=[p.name for p in image_paths],
        source="cli",
        image_refs=image_refs or None,
    )

    if saved:
        product_data_id, analyzed_at = saved
        console.print(
            f"\n[bold green]✓ Stored in MongoDB:[/bold green] "
            f"[cyan]{MONGO_DB}.{PRODUCT_DATA_COLLECTION}[/cyan]  "
            f"[dim]product_data_id: {product_data_id} | images stored: {len(image_ids)}/{len(image_paths)}[/dim]"
        )
        console.print(
            f"[dim]  → Next: POST /products/confirm to link or create a product_info record.[/dim]"
        )
    else:
        console.print(
            "\n[yellow]⚠ Could not reach MongoDB — result not persisted.[/yellow]"
        )

    # ── Serialize and print result ────────────────────────────────────────────
    json_output = json.dumps(result, indent=args.indent, ensure_ascii=False)

    console.print("[bold green]✓ Extraction complete[/bold green]\n")
    syntax = Syntax(json_output, "json", theme="monokai", line_numbers=False)
    console.print(syntax)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json_output, encoding="utf-8")
        console.print(
            f"\n[bold green]✓ Saved to:[/bold green] [underline]{output_path.resolve()}[/underline]"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
