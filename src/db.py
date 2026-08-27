"""
MongoDB storage layer.

Persists every successful extraction into:
    host       : localhost:27017 (configurable via MONGO_URI)
    database   : Competition_intelligence
    collection : Product_data

Storage is best-effort: if MongoDB is unreachable the caller still gets
its extraction result — save_product_data() logs a warning and returns None.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pymongo import MongoClient
from pymongo.errors import PyMongoError
from gridfs import GridFSBucket
from bson import ObjectId
from bson.errors import InvalidId

# ── Configuration (env-overridable) ─────────────────────────────────────────
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.environ.get("MONGO_DB", "Competition_intelligence")
MONGO_COLLECTION = os.environ.get("MONGO_COLLECTION", "Product_data")

# Server selection timeout kept short so API responses aren't hung up for
# 30s when Mongo is down — fail fast and warn instead.
SERVER_SELECTION_TIMEOUT_MS = int(os.environ.get("MONGO_TIMEOUT_MS", "3000"))

_client: Optional[MongoClient] = None
_bucket = None


def _get_client() -> MongoClient:
    """Lazy singleton MongoClient."""
    global _client
    if _client is None:
        _client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=SERVER_SELECTION_TIMEOUT_MS,
        )
    return _client


def _get_bucket() -> GridFSBucket:
    """Lazy singleton GridFSBucket for storing image files."""
    global _bucket
    if _bucket is None:
        _bucket = GridFSBucket(_get_client()[MONGO_DB])
    return _bucket


def get_collection():
    """Return the Product_data collection handle (does not connect yet)."""
    return _get_client()[MONGO_DB][MONGO_COLLECTION]


def save_image(
    data: bytes,
    filename: str,
    content_type: Optional[str] = None,
) -> Optional[str]:
    """
    Store an image in MongoDB GridFS.

    Returns the GridFS file id as a string, or None on failure
    (warning printed to stderr).
    """
    try:
        file_id = _get_bucket().upload_from_stream(
            filename,
            data,
            metadata={"contentType": content_type or "application/octet-stream"},
        )
        return str(file_id)
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: could not store image '{filename}' "
            f"({type(exc).__name__}: {exc}) — continuing without persistence.",
            file=sys.stderr,
        )
        return None


def get_image(image_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch a stored image by GridFS id.

    Returns {"data": bytes, "filename": str, "content_type": str}
    or None if not found / invalid id / Mongo unreachable.
    """
    try:
        oid = ObjectId(image_id)
        bucket = _get_bucket()
        grid_out = bucket.open_download_stream(oid)
        content_type = "application/octet-stream"
        if grid_out.metadata and grid_out.metadata.get("contentType"):
            content_type = grid_out.metadata["contentType"]
        return {
            "data": grid_out.read(),
            "filename": grid_out.filename,
            "content_type": content_type,
        }
    except (PyMongoError, InvalidId) as exc:
        print(
            f"[mongodb] WARNING: could not fetch image '{image_id}' "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return None


def save_product_data(
    result: Dict[str, Any],
    *,
    model: str,
    image_filenames: List[Optional[str]],
    source: str,
    image_refs: Optional[List[Dict[str, Any]]] = None,
) -> Optional[str]:
    """
    Persist an extraction result to MongoDB.

    Parameters
    ----------
    result : dict
        The extracted product data (as returned by extract_product_data).
    model : str
        The OpenAI model used for the extraction.
    image_filenames : list of str or None
        Original uploaded file names.
    source : str
        Where this extraction came from ("api" or "cli").
    image_refs : list of dict, optional
        GridFS references for the stored images:
        [{filename, content_type, size, gridfs_id}, ...]

    Returns
    -------
    str or None
        The inserted document's _id as a string, or None if storage failed
        (a warning is printed to stderr in that case).
    """
    try:
        document = {
            **result,
            "metadata": {
                "model": model,
                "image_filenames": [f for f in image_filenames if f],
                "source": source,
                "created_at": datetime.now(timezone.utc),
            },
        }
        if image_refs:
            document["metadata"]["images"] = image_refs
        inserted = get_collection().insert_one(document)
        return str(inserted.inserted_id)
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: could not store result "
            f"({type(exc).__name__}: {exc}) — continuing without persistence.",
            file=sys.stderr,
        )
        return None
