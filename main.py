"""
GptModel — Product Intelligence & OCR Extraction CLI

Usage
-----
    uv run main.py --images front.jpg back.jpg side.jpg
    uv run main.py --images product.png --output result.json
    uv run main.py --images img.jpg --model gpt-4o --output out.json
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

import openai
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax

# Load .env file if present (picks up OPENAI_API_KEY + OPENAI_BASE_URL)
load_dotenv()

console = Console()

DEFAULT_MODEL = "gpt-5-mini"

app = FastAPI(title="GptModel API", version="1.0.0")


@app.get("/health")
async def health():
    """Check gateway configuration and API key status."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    base_url_raw = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com")
    # Mirror the same normalization as the extractor
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


@app.post("/extract")
async def extract(
    images: list[UploadFile] = File(...),
    model: str = Form(DEFAULT_MODEL),
    temperature: float = Form(1),
):
    """Upload product images and get structured JSON extraction."""
    from src.extractor import extract_product_data

    # Read gateway config from .env (already loaded at startup via load_dotenv)
    base_url = os.environ.get("OPENAI_BASE_URL") or None

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

        # Persist to MongoDB (best-effort — returns None if Mongo is down)
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
        mongo_id = save_product_data(
            result,
            model=model,
            image_filenames=[filename for filename, _, _ in image_payloads],
            source="api",
            image_refs=image_refs or None,
        )
        if mongo_id:
            result["mongodb_id"] = mongo_id
        if image_ids:
            result["image_ids"] = image_ids

        return result  # already a plain dict — FastAPI serializes it directly

    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    except openai.AuthenticationError as exc:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "Authentication failed",
                "message": "Invalid or missing OPENAI_API_KEY.",
                "gateway": base_url or "https://api.openai.com",
            },
        )

    except openai.PermissionDeniedError as exc:
        raise HTTPException(
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

    except openai.NotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "Model not found",
                "message": f"The model '{model}' was not found on the gateway.",
                "gateway": base_url or "https://api.openai.com",
                "model": model,
                "hint": "Check that the model name is supported by your gateway (e.g. gpt-4o-mini).",
            },
        )

    except openai.RateLimitError as exc:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "message": "Too many requests. Please slow down or upgrade your plan.",
                "gateway": base_url or "https://api.openai.com",
            },
        )

    except openai.APIStatusError as exc:
        # Catch-all for any other HTTP error from the gateway/OpenAI
        # Strip HTML from the body if present
        raw_body = exc.response.text if hasattr(exc, "response") else str(exc)
        is_html = raw_body.strip().startswith("<")
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "error": f"Gateway error (HTTP {exc.status_code})",
                "message": "The gateway returned an error. See 'raw_body' for details." if is_html else raw_body,
                "raw_body": raw_body if is_html else None,
                "gateway": base_url or "https://api.openai.com",
                "model": model,
            },
        )

    except openai.APIConnectionError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Cannot connect to gateway",
                "message": str(exc),
                "gateway": base_url or "https://api.openai.com",
            },
        )

    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": type(exc).__name__, "message": str(exc)})

    finally:
        # Always clean up temp files
        shutil.rmtree(tmp_dir, ignore_errors=True)


@app.get("/images/{image_id}")
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

    # Lazy import to keep startup fast even if API libs aren't installed
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

    # Resolve image paths
    image_paths = [Path(p) for p in args.images]

    # Validate existence early with friendly messages
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
    import mimetypes

    from src.db import MONGO_COLLECTION, MONGO_DB, save_image, save_product_data
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
    mongo_id = save_product_data(
        result.model_dump(),
        model=args.model,
        image_filenames=[p.name for p in image_paths],
        source="cli",
        image_refs=image_refs or None,
    )
    if mongo_id:
        console.print(
            f"\n[bold green]✓ Stored in MongoDB:[/bold green] "
            f"[cyan]{MONGO_DB}.{MONGO_COLLECTION}[/cyan]  "
            f"[dim]_id: {mongo_id} | images stored: {len(image_ids)}/{len(image_paths)}[/dim]"
        )
    else:
        console.print(
            "\n[yellow]⚠ Could not reach MongoDB — result not persisted.[/yellow]"
        )

    # Serialize result
    json_output = json.dumps(
        result.model_dump(),
        indent=args.indent,
        ensure_ascii=False,
    )

    # ── Print to stdout ──────────────────────────────────────────────────────
    console.print("[bold green]✓ Extraction complete[/bold green]\n")

    syntax = Syntax(json_output, "json", theme="monokai", line_numbers=False)
    console.print(syntax)

    # ── Optional file save ───────────────────────────────────────────────────
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
