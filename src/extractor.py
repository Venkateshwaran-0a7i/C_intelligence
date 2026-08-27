"""
Core extraction engine.

Loads images from disk, encodes them to base64, builds the OpenAI
multimodal payload, and returns a validated ProductExtractionResult.
"""

from __future__ import annotations

import base64
import json
import mimetypes
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from openai import OpenAI

from .prompt import SYSTEM_PROMPT, build_user_message

# Supported image MIME types accepted by the OpenAI Vision API
SUPPORTED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}


def _get_mime_type(path: Path) -> str:
    """Detect MIME type for an image file."""
    mime, _ = mimetypes.guess_type(str(path))
    if mime is None:
        # Fall back based on extension
        ext = path.suffix.lower()
        fallback = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        mime = fallback.get(ext, "image/jpeg")
    return mime


def _encode_image(path: Path) -> tuple[str, str]:
    """
    Read an image file and return (base64_data, mime_type).
    Raises ValueError if the file type is not supported.
    """
    mime = _get_mime_type(path)
    if mime not in SUPPORTED_MIME_TYPES:
        raise ValueError(
            f"Unsupported image type '{mime}' for file '{path}'. "
            f"Supported types: {', '.join(sorted(SUPPORTED_MIME_TYPES))}"
        )
    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")
    return data, mime


def _build_image_content_blocks(image_paths: List[Path]) -> list:
    """
    Build the list of content blocks for the OpenAI multimodal message.
    Each image becomes an image_url block with a base64 data URI.
    """
    blocks = []
    for path in image_paths:
        b64, mime = _encode_image(path)
        blocks.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime};base64,{b64}",
                    "detail": "high",  # Use high-detail OCR mode
                },
            }
        )
    return blocks


def _parse_response(raw: str) -> dict:
    """
    Parse the JSON response from the model.
    Strips any accidental markdown fences if the model includes them.
    """
    text = raw.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        # Remove first line (``` or ```json) and last line (```)
        text = "\n".join(lines[1:-1]).strip()
    return json.loads(text)


def extract_product_data(
    image_paths: List[Path],
    model: str = "gpt-5-mini",
    api_key: str | None = None,
    base_url: str | None = None,
    temperature: float = 1,
) -> dict:
    """
    Main extraction function.

    Parameters
    ----------
    image_paths : list of Path
        One or more paths to product packaging images.
    model : str
        OpenAI model to use (default: gpt-5-mini).
    api_key : str, optional
        OpenAI API key. Falls back to OPENAI_API_KEY env var.
    base_url : str, optional
        Custom API base URL. Falls back to OPENAI_BASE_URL env var.
        Useful for self-hosted gateways or proxies.
    temperature : float
        Model temperature. gpt-5 models only support temperature=1 (default).

    Returns
    -------
    dict
        Raw extracted product data matching the schema defined in prompt.py.

    Raises
    ------
    FileNotFoundError
        If any image path does not exist.
    ValueError
        If no images provided, unsupported image type, or model returns bad output.
    openai.OpenAIError
        On API errors.
    """
    if not image_paths:
        raise ValueError("At least one image path must be provided.")

    # Validate all paths exist before calling the API
    for p in image_paths:
        if not p.exists():
            raise FileNotFoundError(f"Image not found: {p}")
        if not p.is_file():
            raise ValueError(f"Path is not a file: {p}")

    # Resolve credentials — explicit args take priority, then env vars
    resolved_api_key = api_key or os.environ.get("OPENAI_API_KEY")
    resolved_base_url = base_url or os.environ.get("OPENAI_BASE_URL") or None

    # Normalize base_url: the OpenAI SDK does NOT auto-append /v1.
    # Most gateways expect requests at /v1/chat/completions, so we ensure
    # the base URL ends with /v1 (strips any trailing slash first).
    if resolved_base_url:
        resolved_base_url = resolved_base_url.rstrip("/")
        if not resolved_base_url.endswith("/v1"):
            resolved_base_url = f"{resolved_base_url}/v1"

    client = OpenAI(
        api_key=resolved_api_key,
        base_url=resolved_base_url,  # None → default OpenAI endpoint
    )

    # Build the multimodal content: text instruction + all image blocks
    user_text_block = {
        "type": "text",
        "text": build_user_message(len(image_paths)),
    }
    image_blocks = _build_image_content_blocks(image_paths)
    user_content = [user_text_block] + image_blocks

    # gpt-5 family (gpt-5, gpt-5-mini, gpt-5-codex, gpt-5.1, etc.) only
    # accept temperature=1. Enforce this server-side so callers never need
    # to remember — the gateway will 400 on any other value.
    if model.startswith("gpt-5"):
        temperature = 1

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=temperature,
        max_tokens=8192,
        response_format={"type": "json_object"},  # Force valid JSON output
    )

    choice = response.choices[0]
    raw_output = choice.message.content or ""
    finish_reason = choice.finish_reason  # "stop" | "length" | "content_filter" | None

    # Guard: empty response
    if not raw_output.strip():
        reason_hint = {
            "length": "Response was cut off — max_tokens reached. Try fewer images.",
            "content_filter": "Response was blocked by the content filter.",
        }.get(finish_reason or "", f"finish_reason={finish_reason!r}")
        raise ValueError(
            f"Model returned an empty response. {reason_hint}"
        )

    try:
        parsed = _parse_response(raw_output)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Model returned invalid JSON (finish_reason={finish_reason!r}).\n"
            f"Raw response:\n{raw_output}\n"
            f"Parse error: {exc}"
        ) from exc

    # Inject extraction timestamp (UTC, ISO 8601 with Z suffix).
    parsed["extracted_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Return the raw parsed dict — the schema is enforced by the prompt.
    # Bypassing Pydantic here preserves the full nested structure from prompt.py
    # without stripping fields that don't exist in the old model.
    return parsed
