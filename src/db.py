"""
MongoDB storage layer — Product Intelligence + LIMS Backend.

Collections
-----------
product_data          : Immutable extraction snapshots (one per upload/scan).
product_info          : Lightweight deduplicated product index (one per real product).
lims_sc               : LIMS sample containers (read-only).
lims_pg               : LIMS parameter groups (read-only).
lims_pa               : LIMS parameter analyses / results (read-only).
fs.files / fs.chunks  : GridFS image storage.

Storage is best-effort: if MongoDB is unreachable callers still get their
extraction result — save_product_data() logs a warning and returns None.
"""

from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId
from bson.errors import InvalidId
from gridfs import GridFSBucket
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import PyMongoError

# ── Configuration (env-overridable) ─────────────────────────────────────────
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.environ.get("MONGO_DB", "Competition_intelligence")

# product_data — immutable extraction snapshots
PRODUCT_DATA_COLLECTION = os.environ.get("PRODUCT_DATA_COLLECTION", "product_data")

# product_info — lightweight deduplicated product index
PRODUCT_INFO_COLLECTION = os.environ.get("PRODUCT_INFO_COLLECTION", "product_info")

# LIMS collections (read-only; already exist in the database)
LIMS_MONGO_DB     = os.environ.get("LIMS_MONGO_DB", "lims")  # separate DB from Competition_intelligence
LIMS_SC_COLLECTION = os.environ.get("LIMS_SC_COLLECTION", "lims_sc")
LIMS_PG_COLLECTION = os.environ.get("LIMS_PG_COLLECTION", "lims_pg")
LIMS_PA_COLLECTION = os.environ.get("LIMS_PA_COLLECTION", "lims_pa")

# competition_sessions — frozen multi-brand comparison snapshots
COMPETITION_SESSIONS_COLLECTION = os.environ.get(
    "COMPETITION_SESSIONS_COLLECTION", "competition_sessions"
)

# Kept for backward-compat with CLI usage (console output only)
MONGO_COLLECTION = PRODUCT_DATA_COLLECTION

# Server selection timeout: fail fast when Mongo is down
SERVER_SELECTION_TIMEOUT_MS = int(os.environ.get("MONGO_TIMEOUT_MS", "3000"))

_client: Optional[MongoClient] = None
_bucket = None


# ── Internal helpers ─────────────────────────────────────────────────────────

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
    """Lazy singleton GridFSBucket for image files."""
    global _bucket
    if _bucket is None:
        _bucket = GridFSBucket(_get_client()[MONGO_DB])
    return _bucket


def _col(name: str):
    """Return a collection handle in the main Competition_intelligence database."""
    return _get_client()[MONGO_DB][name]


def _lims_col(name: str):
    """Return a collection handle in the separate LIMS database."""
    return _get_client()[LIMS_MONGO_DB][name]


def _now_iso() -> str:
    """Return current UTC time as ISO-8601 string with Z suffix."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


_PLACEHOLDER_VALUES = {"", "not available", "n/a", "na", "none", "null"}


def _normalize(text: str) -> str:
    """Lowercase + strip for fuzzy matching. Returns '' for placeholder
    values so they never contribute to a match score."""
    cleaned = (text or "").lower().strip()
    return "" if cleaned in _PLACEHOLDER_VALUES else cleaned


def _mongo_doc_to_json(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively convert ObjectId / datetime values to strings for JSON output."""
    if doc is None:
        return {}
    result = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, datetime):
            result[k] = v.strftime("%Y-%m-%dT%H:%M:%SZ")
        elif isinstance(v, dict):
            result[k] = _mongo_doc_to_json(v)
        elif isinstance(v, list):
            result[k] = [
                _mongo_doc_to_json(i) if isinstance(i, dict) else
                (str(i) if isinstance(i, (ObjectId, datetime)) else i)
                for i in v
            ]
        else:
            result[k] = v
    return result


def _id_filter(id_val: str, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Build a MongoDB query matching `_id` as either string or ObjectId."""
    conds: List[Dict[str, Any]] = [{"_id": id_val}]
    try:
        conds.append({"_id": ObjectId(id_val)})
    except Exception:
        pass

    if extra:
        return {"$and": [{"$or": conds}, extra]}
    return {"$or": conds}


# ── GridFS image storage ─────────────────────────────────────────────────────

def save_image(
    data: bytes,
    filename: str,
    content_type: Optional[str] = None,
) -> Optional[str]:
    """
    Store an image in MongoDB GridFS.
    Returns the GridFS file id as a string, or None on failure.
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
    Returns {data, filename, content_type} or None.
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


# ── product_data (immutable, append-only) ────────────────────────────────────

def save_product_data(
    result: Dict[str, Any],
    *,
    model: str,
    image_filenames: List[Optional[str]],
    source: str,
    image_refs: Optional[List[Dict[str, Any]]] = None,
) -> Optional[Tuple[str, str]]:
    """
    Persist an extraction result to the ``product_data`` collection.

    Parameters
    ----------
    result : dict
        The extracted product data (as returned by extract_product_data).
    model : str
        The OpenAI model used for the extraction.
    image_filenames : list of str
        Original uploaded file names.
    source : str
        ``"api"`` or ``"cli"``.
    image_refs : list of dict, optional
        GridFS references for the stored images.

    Returns
    -------
    (product_data_id, analyzed_at) or None
        product_data_id is the string ``_id`` of the inserted document.
        analyzed_at is the UTC ISO-8601 timestamp string.
        Returns None if storage failed (warning printed to stderr).
    """
    try:
        analyzed_at = _now_iso()
        # Use the timestamp already embedded by the extractor if present,
        # otherwise fall back to the one we just computed.
        analyzed_at = result.get("extracted_at") or analyzed_at

        metadata: Dict[str, Any] = {
            "model": model,
            "image_filenames": [f for f in image_filenames if f],
            "source": source,
            "created_at": datetime.now(timezone.utc),
        }
        if image_refs:
            metadata["images"] = image_refs

        # Build the document — full extracted payload + top-level analyzed_at
        # Strip any legacy top-level keys that we now hoist
        doc_payload = {k: v for k, v in result.items() if k not in ("extracted_at", "metadata")}
        document: Dict[str, Any] = {
            **doc_payload,
            "analyzed_at": analyzed_at,
            "metadata": metadata,
        }

        inserted = _col(PRODUCT_DATA_COLLECTION).insert_one(document)
        product_data_id = str(inserted.inserted_id)
        return product_data_id, analyzed_at
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: could not store result "
            f"({type(exc).__name__}: {exc}) — continuing without persistence.",
            file=sys.stderr,
        )
        return None


def get_product_data(product_data_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a single product_data document by its _id string or ObjectId."""
    try:
        doc = _col(PRODUCT_DATA_COLLECTION).find_one(_id_filter(product_data_id))
        if doc is None:
            return None
        return _mongo_doc_to_json(doc)
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: could not fetch product_data '{product_data_id}' "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return None


# ── Product matching / recommendation ────────────────────────────────────────

def find_product_candidates(
    product_name: Optional[str] = None,
    brand: Optional[str] = None,
    variant: Optional[str] = None,
    net_quantity: Optional[str] = None,
    barcode: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Search ``product_info`` for candidate matches using a weighted scoring system.

    Scoring:
        barcode exact match:         +50  (exact only — no fuzzy/edit-distance)
        brand exact match:           +30 | brand substring: +15
        name exact match:            +40 | name substring:  +20
        variant exact match:         +15 | variant substring: +5
        variant clear mismatch:      -40  (both non-empty, neither contains the other)
        net_quantity exact match:    +15
        net_quantity clear mismatch: -20  (both non-empty but different)

    Returns
    -------
    All candidates scoring >= 30, sorted by score descending.
    Each entry: {product_id, product_name, brand, variant, net_quantity, score}
    """
    try:
        col = _col(PRODUCT_INFO_COLLECTION)
        # Pull all docs — product_info stays small (one per real product)
        docs = list(col.find({}))
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: could not query product_info "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return []

    q_name = _normalize(product_name or "")
    q_brand = _normalize(brand or "")
    q_variant = _normalize(variant or "")
    q_qty = _normalize(net_quantity or "")
    q_barcode = _normalize(barcode or "")

    results = []
    for doc in docs:
        score = 0

        doc_name = _normalize(doc.get("product_name", ""))
        doc_brand = _normalize(doc.get("brand", ""))
        doc_variant = _normalize(doc.get("variant", ""))
        doc_qty = _normalize(doc.get("net_quantity", ""))
        doc_barcode = _normalize(doc.get("barcode", ""))

        # Barcode — highest weight, exact only.
        # Fuzzy/edit-distance barcode matching is explicitly rejected: this
        # manufacturer uses sequential SKU numbering so near-identical barcodes
        # do NOT reliably indicate the same product.
        if q_barcode and doc_barcode and q_barcode == doc_barcode:
            score += 50

        # Brand
        if q_brand and doc_brand:
            if q_brand == doc_brand:
                score += 30
            elif q_brand in doc_brand or doc_brand in q_brand:
                score += 15

        # Product name
        if q_name and doc_name:
            if q_name == doc_name:
                score += 40
            elif q_name in doc_name or doc_name in q_name:
                score += 20

        # Variant
        if q_variant and doc_variant:
            if q_variant == doc_variant:
                score += 15
            elif q_variant in doc_variant or doc_variant in q_variant:
                score += 5
            else:
                # Both present, neither contains the other → clear mismatch
                score -= 40

        # Net quantity
        if q_qty and doc_qty:
            if q_qty == doc_qty:
                score += 15
            else:
                # Both non-empty but different → clear mismatch
                score -= 20

        if score >= 30:
            results.append({
                "product_id": str(doc["_id"]),
                "product_name": doc.get("product_name", ""),
                "brand": doc.get("brand", ""),
                "variant": doc.get("variant", ""),
                "net_quantity": doc.get("net_quantity", ""),
                "score": score,
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results


# ── Auto product linking ──────────────────────────────────────────────────────

AUTO_LINK_SCORE_THRESHOLD = 70


def auto_link_or_create_product(
    product_data_id: str,
    is_competitor: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    Automatically link a product_data scan to an existing product_info document,
    or create a new one if no confident match exists.

    Uses find_product_candidates() for scoring (unchanged scoring logic,
    including "Not Available" placeholder filtering and variant clear-mismatch
    penalty already in place). If the top candidate scores >=
    AUTO_LINK_SCORE_THRESHOLD, links to it; otherwise creates a new
    product_info document.

    The resulting scan_history entry's product_match_confirmed_by is set to
    ``"system-auto"`` to distinguish automated links from human-confirmed ones
    in the audit trail. The match score is also recorded for transparency.

    Returns
    -------
    {
        "product_info": <the linked or created product_info document>,
        "action": "link" | "create_new",
        "match_score": <int or None>,
    }
    """
    pd_doc = get_product_data(product_data_id)
    if pd_doc is None:
        raise ValueError(f"product_data document not found: {product_data_id}")

    identity = _extract_identity_fields(pd_doc)

    candidates = find_product_candidates(
        product_name=identity["product_name"],
        brand=identity["brand"],
        variant=identity["variant"],
        net_quantity=identity["net_quantity"],
        barcode=identity.get("barcode"),
    )

    top = candidates[0] if candidates else None

    if top and top["score"] >= AUTO_LINK_SCORE_THRESHOLD:
        result = confirm_product_match(
            product_data_id=product_data_id,
            action="link",
            confirmed_by="system-auto",
            product_id=top["product_id"],
            is_competitor=is_competitor,  # accepted but ignored on link path
        )
        return {
            "product_info": result,
            "action": "link",
            "match_score": top["score"],
        }
    else:
        result = confirm_product_match(
            product_data_id=product_data_id,
            action="create_new",
            confirmed_by="system-auto",
            is_competitor=is_competitor,
        )
        return {
            "product_info": result,
            "action": "create_new",
            "match_score": top["score"] if top else None,
        }


# ── product_info create / update ─────────────────────────────────────────────

def _extract_identity_fields(product_data_doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pull identity fields from a product_data document's product_identification block.
    """
    pi = product_data_doc.get("product_identification", {})

    def _val(block: Dict[str, Any]) -> str:
        if isinstance(block, dict):
            return block.get("value", "Not Available")
        return str(block) if block else "Not Available"

    return {
        "product_name": _val(pi.get("product_name", {})),
        "brand": _val(pi.get("product_brand", {})),
        "variant": _val(pi.get("product_variant", {})),
        "net_quantity": _val(pi.get("net_quantity", {})),
        "business": _val(pi.get("business", {})),
        "division": _val(pi.get("division", {})),
        "product_category": _val(pi.get("product_category", {})),
        "barcode": product_data_doc.get("product_identifiers", {}).get("barcode", "Not Available"),
    }


def confirm_product_match(
    product_data_id: str,
    action: str,  # "link" | "create_new"
    confirmed_by: str,
    product_id: Optional[str] = None,
    is_competitor: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """
    Confirm a product match either by linking to an existing product_info document
    or by creating a new one.

    Parameters
    ----------
    product_data_id : str
        The _id of the product_data document for this scan.
    action : str
        ``"link"`` or ``"create_new"``.
    confirmed_by : str
        Username / identifier of the person confirming.
    product_id : str, optional
        Required when action == ``"link"``.
    is_competitor : bool, optional
        Required when action == ``"create_new"``.
        When action == ``"link"`` this parameter is accepted but ignored --
        the existing product_info document's classification is never overwritten.

    Returns
    -------
    Updated or newly created product_info document (as dict), or None on error.
    """
    # Validate is_competitor before touching the database
    if action == "create_new" and is_competitor is None:
        raise ValueError(
            "is_competitor must be specified when creating a new product "
            "(true = competitor product, false = own product)."
        )

    # Fetch the product_data document to get analyzed_at
    pd_doc = get_product_data(product_data_id)
    if pd_doc is None:
        raise ValueError(f"product_data document not found: {product_data_id}")

    analyzed_at = pd_doc.get("analyzed_at", _now_iso())

    scan_entry: Dict[str, Any] = {
        "product_data_id": product_data_id,
        "analyzed_at": analyzed_at,
        "lims_sc_value": None,
        "lims_confirmed_by": None,
        "product_match_confirmed_by": confirmed_by,
    }

    try:
        col = _col(PRODUCT_INFO_COLLECTION)

        if action == "link":
            if not product_id:
                raise ValueError("product_id is required when action is 'link'")

            # is_competitor is intentionally NOT updated here — the existing
            # product's classification was set at creation and must not be
            # silently overwritten by a mismatched value passed in a link call.
            result = col.find_one_and_update(
                _id_filter(product_id),
                {"$push": {"scan_history": scan_entry}},
                return_document=True,
            )
            if result is None:
                raise ValueError(f"product_info document not found: {product_id}")
            return _mongo_doc_to_json(result)

        elif action == "create_new":
            identity = _extract_identity_fields(pd_doc)
            now = _now_iso()

            # Store the GridFS ID of the first image so the frontend can call
            # GET /images/{gridfs_id} directly. The schema says
            # metadata.images[0].gridfs_id is the canonical display image source.
            first_image = ""
            images = pd_doc.get("metadata", {}).get("images", [])
            if images:
                first_image = images[0].get("gridfs_id", "") or images[0].get("filename", "")

            new_doc: Dict[str, Any] = {
                **identity,
                "normalized_product_name": _normalize(identity["product_name"]),
                "normalized_brand": _normalize(identity["brand"]),
                "first_uploaded_image": first_image,
                "is_competitor": is_competitor,
                "merged_from": [],
                "needs_manual_review": False,
                "created_at": now,
                "scan_history": [scan_entry],
            }
            inserted = col.insert_one(new_doc)
            new_doc["_id"] = str(inserted.inserted_id)
            return _mongo_doc_to_json(new_doc)

        else:
            raise ValueError(f"Invalid action: {action!r}. Must be 'link' or 'create_new'.")

    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: confirm_product_match failed "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return None


# ── LIMS list / link ──────────────────────────────────────────────────────────

# Field paths in the lims_sc collection (all values live inside additional_data)
_AD = "additional_data"


def list_lims_samples(limit: int = 1000) -> List[Dict[str, Any]]:
    """
    Return LIMS samples (lims_sc), most recent first, with no server-side
    filtering or relevance ranking. The frontend handles all text filtering
    client-side over this full list.

    Returns up to *limit* results: [{sc, sc_value, description, sampling_date}].

    Real document shape:
        { additional_data: { SC_VALUE, DESCRIPTION, SAMPLING_DATE (ISO str), … } }
    """
    try:
        col = _lims_col(LIMS_SC_COLLECTION)
        cursor = (
            col.find(
                {},
                {f"{_AD}.SC_VALUE": 1, f"{_AD}.DESCRIPTION": 1, f"{_AD}.SAMPLING_DATE": 1},
            )
            .sort([(f"{_AD}.SAMPLING_DATE", DESCENDING)])
            .limit(limit)
        )
        results = []
        for doc in cursor:
            ad = doc.get(_AD) or {}
            sc_value = str(ad.get("SC_VALUE") or "")
            sampling_date = str(ad.get("SAMPLING_DATE") or "")
            # Normalise ISO string — strip sub-second precision and TZ offset for display
            if "T" in sampling_date:
                sampling_date = sampling_date[:19]  # keep YYYY-MM-DDTHH:MM:SS
            results.append({
                "sc": sc_value,
                "sc_value": sc_value,
                "description": str(ad.get("DESCRIPTION") or ""),
                "sampling_date": sampling_date,
            })
        return results
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: list_lims_samples failed "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return []


def list_lims_admin(limit: int = 2000) -> List[Dict[str, Any]]:
    """
    Return every lims_sc document, most recent first, enriched with
    ``linked_product_count`` — the number of distinct product_info documents
    whose scan_history contains this sc_value.

    Used by the LIMS admin page.
    Returns [{sc_value, description, sampling_date, linked_product_count}].
    """
    try:
        # 1. Fetch all lims_sc rows
        sc_col = _lims_col(LIMS_SC_COLLECTION)
        cursor = (
            sc_col.find(
                {},
                {f"{_AD}.SC_VALUE": 1, f"{_AD}.DESCRIPTION": 1, f"{_AD}.SAMPLING_DATE": 1},
            )
            .sort([(f"{_AD}.SAMPLING_DATE", DESCENDING)])
            .limit(limit)
        )
        rows = []
        sc_values = []
        for doc in cursor:
            ad = doc.get(_AD) or {}
            sv = str(ad.get("SC_VALUE") or "")
            sampling_date = str(ad.get("SAMPLING_DATE") or "")
            if "T" in sampling_date:
                sampling_date = sampling_date[:19]
            sc_values.append(sv)
            rows.append({
                "sc_value": sv,
                "description": str(ad.get("DESCRIPTION") or ""),
                "sampling_date": sampling_date,
                "linked_product_count": 0,
            })

        if not rows:
            return []

        # 2. Count linked products per sc_value via a single aggregation
        pi_col = _col(PRODUCT_INFO_COLLECTION)
        agg = pi_col.aggregate([
            {"$unwind": "$scan_history"},
            {"$match": {"scan_history.lims_sc_value": {"$in": sc_values, "$ne": None}}},
            {"$group": {
                "_id": "$scan_history.lims_sc_value",
                "count": {"$addToSet": "$_id"},
            }},
            {"$project": {"_id": 1, "count": {"$size": "$count"}}},
        ])
        count_map: Dict[str, int] = {r["_id"]: r["count"] for r in agg}

        # 3. Merge counts back
        for row in rows:
            row["linked_product_count"] = count_map.get(row["sc_value"], 0)

        return rows
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: list_lims_admin failed "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return []


def link_lims_sample(
    product_data_id: str,
    product_id: str,
    lims_sc_value: str,
    confirmed_by: str,
) -> Optional[Dict[str, Any]]:
    """
    Attach a LIMS sample (lims_sc_value) to a specific scan_history entry in
    the given product_info document.

    Validates that lims_sc_value exists in lims_sc before writing.
    Returns the updated product_info document, or None on error.
    """
    # 1. Validate lims_sc_value exists in the lims DB
    try:
        lims_doc = _lims_col(LIMS_SC_COLLECTION).find_one(
            {f"{_AD}.SC_VALUE": lims_sc_value}
        )
        if lims_doc is None:
            raise ValueError(f"lims_sc_value not found in lims_sc: {lims_sc_value!r}")
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: lims_sc lookup failed ({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return None

    # 2. Update the matching scan_history entry
    try:
        result = _col(PRODUCT_INFO_COLLECTION).find_one_and_update(
            _id_filter(product_id, {"scan_history.product_data_id": product_data_id}),
            {
                "$set": {
                    "scan_history.$.lims_sc_value": lims_sc_value,
                    "scan_history.$.lims_confirmed_by": confirmed_by,
                }
            },
            return_document=True,
        )
        if result is None:
            raise ValueError(
                f"No matching scan_history entry found for product_id={product_id!r}, "
                f"product_data_id={product_data_id!r}"
            )
        return _mongo_doc_to_json(result)
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: link_lims_sample failed "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return None


# ── Product list (paginated) ─────────────────────────────────────────────────

def list_products(
    page: int = 1,
    page_size: int = 20,
    business: Optional[str] = None,
    division: Optional[str] = None,
    brand: Optional[str] = None,
    product_category: Optional[str] = None,
    is_competitor: Optional[bool] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    uploaded_data: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Return paginated product_info documents enriched with:
    - scan_count  : number of scan_history entries
    - latest_analyzed_at : max analyzed_at across scan_history entries

    Supports filters: business, division, brand, product_category, date_from, date_to.
    """
    pipeline: List[Dict[str, Any]] = []

    # ── Match filters ────────────────────────────────────────────────────────
    match_stage: Dict[str, Any] = {}
    if business:
        match_stage["business"] = {"$regex": re.escape(business), "$options": "i"}
    if division:
        match_stage["division"] = {"$regex": re.escape(division), "$options": "i"}
    if brand:
        match_stage["brand"] = {"$regex": re.escape(brand), "$options": "i"}
    if product_category:
        match_stage["product_category"] = {"$regex": re.escape(product_category), "$options": "i"}
    if is_competitor is not None:
        match_stage["is_competitor"] = is_competitor
    if search:
        pattern = {"$regex": re.escape(search), "$options": "i"}
        match_stage["$or"] = [
            {"product_name": pattern},
            {"brand": pattern},
        ]
    # Uploaded-data quality filter
    if uploaded_data == "has_images":
        match_stage["first_uploaded_image"] = {"$exists": True, "$nin": [None, ""]}
    elif uploaded_data == "missing_images":
        match_stage["$or"] = match_stage.get("$or", []) + [
            {"first_uploaded_image": {"$exists": False}},
            {"first_uploaded_image": None},
            {"first_uploaded_image": ""},
        ]
    elif uploaded_data == "needs_review":
        match_stage["needs_manual_review"] = True
    if match_stage:
        pipeline.append({"$match": match_stage})

    # ── Add computed fields ──────────────────────────────────────────────────
    pipeline.append({
        "$addFields": {
            "scan_count": {"$size": {"$ifNull": ["$scan_history", []]}},
            "latest_analyzed_at": {
                "$max": {
                    "$map": {
                        "input": {"$ifNull": ["$scan_history", []]},
                        "as": "s",
                        "in": "$$s.analyzed_at",
                    }
                }
            },
        }
    })

    # ── Date range filter on latest_analyzed_at ──────────────────────────────
    if date_from or date_to:
        date_filter: Dict[str, Any] = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        pipeline.append({"$match": {"latest_analyzed_at": date_filter}})

    # ── Project output fields ────────────────────────────────────────────────
    pipeline.append({
        "$project": {
            "product_name": 1,
            "brand": 1,
            "variant": 1,
            "net_quantity": 1,
            "business": 1,
            "division": 1,
            "product_category": 1,
            "is_competitor": 1,
            "first_uploaded_image": 1,
            "created_at": 1,
            "scan_count": 1,
            "latest_analyzed_at": 1,
        }
    })

    # ── Pagination ───────────────────────────────────────────────────────────
    skip = (page - 1) * page_size

    count_pipeline = pipeline + [{"$count": "total"}]
    data_pipeline = pipeline + [
        {"$sort": {"latest_analyzed_at": DESCENDING}},
        {"$skip": skip},
        {"$limit": page_size},
    ]

    try:
        col = _col(PRODUCT_INFO_COLLECTION)
        count_result = list(col.aggregate(count_pipeline))
        total = count_result[0]["total"] if count_result else 0
        docs = list(col.aggregate(data_pipeline))
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": [_mongo_doc_to_json(d) for d in docs],
        }
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: list_products failed "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return {"total": 0, "page": page, "page_size": page_size, "items": []}


def get_distinct_filter_values() -> Dict[str, List[str]]:
    """Return sorted distinct non-empty/non-placeholder values for each
    filterable field, used to populate frontend filter dropdowns."""
    col = _col(PRODUCT_INFO_COLLECTION)
    skip = {None, "", "Not Available"}
    return {
        "businesses": sorted(
            v for v in col.distinct("business") if v not in skip
        ),
        "divisions": sorted(
            v for v in col.distinct("division") if v not in skip
        ),
        "brands": sorted(
            v for v in col.distinct("brand") if v not in skip
        ),
        "product_categories": sorted(
            v for v in col.distinct("product_category") if v not in skip
        ),
    }


# ── Product detail ───────────────────────────────────────────────────────────

def _compile_lims_results(sc_value: str) -> Optional[Dict[str, Any]]:
    """
    Join lims_sc -> lims_pg -> lims_pa for a given sc_value.

    Driven by lims_pa (the actual test results), not lims_pg, so a
    result is never hidden just because its parameter-group metadata
    record is missing. lims_pg is used only to look up a display name
    for the group when a matching record exists.
    """
    try:
        sc_doc = _lims_col(LIMS_SC_COLLECTION).find_one(
            {f"{_AD}.SC_VALUE": sc_value}
        )
        if sc_doc is None:
            return None
        # The SC integer key used to join lims_pg / lims_pa is stored in additional_data.SC
        sc = (sc_doc.get(_AD) or {}).get("SC")

        # Fetch all parameter analyses for this sc (authoritative source)
        pas = list(_lims_col(LIMS_PA_COLLECTION).find({"sc": sc}))

        # Fetch all parameter groups for this sc (label lookup only)
        pgs = list(_lims_col(LIMS_PG_COLLECTION).find({"sc": sc}))

        # Map (sc, pg) -> pg document, for label lookup only
        pg_by_key: Dict[str, Dict] = {
            f"{pg.get('sc', '')}_{pg.get('pg', '')}": pg for pg in pgs
        }

        # Group pa results by their pg id -- this is now authoritative
        grouped: Dict[str, List[Dict]] = {}
        for pa in pas:
            pg_key = f"{pa.get('sc', '')}_{pa.get('pg', '')}"
            grouped.setdefault(pg_key, []).append(_mongo_doc_to_json(pa))

        compiled_pgs = []
        for pg_key, analyses in grouped.items():
            pg_doc = pg_by_key.get(pg_key)
            if pg_doc is not None:
                group_entry = {**_mongo_doc_to_json(pg_doc), "analyses": analyses}
            else:
                # No lims_pg record for this group -- still show the results,
                # falling back to the pa row's own description (or a generic
                # label) for the header.
                fallback_name = (
                    analyses[0].get("description")
                    or analyses[0].get("DESCRIPTION")
                    or f"Parameter group {pg_key.split('_')[-1]}"
                )
                group_entry = {
                    "PG_NAME": fallback_name,
                    "parameter_group_name": fallback_name,
                    "sc": sc,
                    "pg": pg_key.split("_")[-1],
                    "analyses": analyses,
                    "_missing_pg_record": True,
                }
                print(
                    f"[mongodb] WARNING: lims_pg record missing for sc={sc} "
                    f"pg_key={pg_key!r} -- using fallback label {fallback_name!r}",
                    file=sys.stderr,
                )
            compiled_pgs.append(group_entry)

        ad = sc_doc.get(_AD) or {}
        sc_value_str = str(ad.get("SC_VALUE") or "")
        description_str = str(ad.get("DESCRIPTION") or "")
        sampling_date_str = str(ad.get("SAMPLING_DATE") or "")
        if "T" in sampling_date_str:
            sampling_date_str = sampling_date_str[:19]

        sample_json = _mongo_doc_to_json(sc_doc)
        # Inject flat fields so the frontend can read them without digging into additional_data
        sample_json["sc_value"] = sc_value_str
        sample_json["description"] = description_str
        sample_json["sampling_date"] = sampling_date_str
        sample_json["SAMPLING_DATE"] = sampling_date_str  # kept for backward-compat with LimsPanel

        return {
            "sample": sample_json,
            "parameter_groups": compiled_pgs,
        }
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: _compile_lims_results failed "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return None


def get_product_detail(product_id: str) -> Optional[Dict[str, Any]]:
    """
    Return a combined product detail object:
    - product_info document
    - Full product_data for the most recent scan (max analyzed_at)
    - Compiled LIMS test results for that scan (if lims_sc_value is set)

    Returns None if product_info not found.
    """
    try:
        info_doc = _col(PRODUCT_INFO_COLLECTION).find_one(_id_filter(product_id))
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: get_product_detail lookup failed "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return None

    if info_doc is None:
        return None

    scan_history: List[Dict] = info_doc.get("scan_history", [])

    # Find the most recent scan entry (max analyzed_at)
    most_recent = None
    if scan_history:
        most_recent = max(
            scan_history,
            key=lambda s: s.get("analyzed_at", ""),
        )

    latest_product_data = None
    lims_results = None

    if most_recent:
        pd_id = most_recent.get("product_data_id")
        if pd_id:
            latest_product_data = get_product_data(pd_id)

        lims_sc_val = most_recent.get("lims_sc_value")
        if lims_sc_val:
            lims_results = _compile_lims_results(lims_sc_val)

    return {
        "product_info": _mongo_doc_to_json(info_doc),
        "latest_product_data": latest_product_data,
        "lims_results": lims_results,
    }


# ── Product scan history ─────────────────────────────────────────────────────

def get_product_history(
    product_id: str,
    expand: bool = False,
) -> Optional[List[Dict[str, Any]]]:
    """
    Return the scan_history list for a product, sorted by analyzed_at ascending.

    Parameters
    ----------
    product_id : str
        The product_info document _id.
    expand : bool
        If True, fetch and inline the full product_data + LIMS results for
        each scan entry. No diffing is performed — raw data only.

    Returns
    -------
    List of scan history entries, or None if product not found.
    """
    try:
        info_doc = _col(PRODUCT_INFO_COLLECTION).find_one(
            _id_filter(product_id),
            {"scan_history": 1},
        )
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: get_product_history failed "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return None

    if info_doc is None:
        return None

    history: List[Dict] = sorted(
        info_doc.get("scan_history", []),
        key=lambda s: s.get("analyzed_at", ""),
    )

    if not expand:
        return history

    # Expand: inline full product_data + LIMS for each entry
    expanded = []
    for entry in history:
        record = dict(entry)
        pd_id = entry.get("product_data_id")
        if pd_id:
            record["product_data"] = get_product_data(pd_id)
        lims_sc_val = entry.get("lims_sc_value")
        if lims_sc_val:
            record["lims_results"] = _compile_lims_results(lims_sc_val)
        expanded.append(record)

    return expanded


# ── Competition sessions ─────────────────────────────────────────────────────

def create_competition_session(
    product_ids: List[str],
    created_by: str,
    name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Freeze a multi-brand comparison at the current moment.

    Resolves each product's LATEST scan_history entry to a product_data_id
    at save time and stores it in ``snapshot_ids``. The snapshot is never
    re-resolved after creation, so a saved comparison never silently drifts
    as new scans come in for those products.

    Parameters
    ----------
    product_ids : list of str
        2 to 4 product_info document _ids to compare.
    created_by : str
        Username / identifier of the person creating the session.
    name : str, optional
        Human-readable label for the session.

    Returns
    -------
    The newly created competition_sessions document (as dict).

    Raises
    ------
    ValueError
        If the number of product_ids is outside the 2–4 range, if a
        product_info document is not found, or if a product has no scans.
    """
    if not (2 <= len(product_ids) <= 4):
        raise ValueError(
            f"A competition session requires 2 to 4 products, got {len(product_ids)}."
        )

    snapshot_ids: List[str] = []
    category_signature: Optional[Dict[str, Any]] = None

    try:
        for pid in product_ids:
            info = _col(PRODUCT_INFO_COLLECTION).find_one(_id_filter(pid))
            if info is None:
                raise ValueError(f"product_info not found: {pid}")

            history = sorted(
                info.get("scan_history", []),
                key=lambda e: e.get("analyzed_at") or "",
            )
            if not history:
                raise ValueError(f"product {pid} has no scans to snapshot.")

            snapshot_ids.append(history[-1]["product_data_id"])

            if category_signature is None:
                category_signature = {
                    "business": info.get("business"),
                    "division": info.get("division"),
                    "product_category": info.get("product_category"),
                }

        doc: Dict[str, Any] = {
            "name": name,
            "product_ids": product_ids,
            "snapshot_ids": snapshot_ids,
            "category_signature": category_signature,
            "created_by": created_by,
            "created_at": _now_iso(),
        }
        inserted = _col(COMPETITION_SESSIONS_COLLECTION).insert_one(doc)
        doc["_id"] = str(inserted.inserted_id)
        return doc

    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: create_competition_session failed "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        raise


def get_competition_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Return a competition session plus the full product_data for each frozen
    snapshot, reconstructed exactly as it was at save time.

    The ``snapshots`` list is ordered to match ``snapshot_ids`` (and therefore
    ``product_ids``) so the caller can zip them together.

    Returns None if the session is not found.
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        return None

    try:
        doc = _col(COMPETITION_SESSIONS_COLLECTION).find_one({"_id": oid})
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: get_competition_session failed "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return None

    if doc is None:
        return None

    doc = _mongo_doc_to_json(doc)
    doc["snapshots"] = [
        get_product_data(pdid) for pdid in doc.get("snapshot_ids", [])
    ]
    return doc


def list_competition_sessions(limit: int = 100) -> List[Dict[str, Any]]:
    """
    Return competition sessions, most recent first.

    Parameters
    ----------
    limit : int
        Maximum number of sessions to return (default 100).

    Returns
    -------
    List of competition_sessions documents (as dicts, no hydrated snapshots).
    """
    try:
        cursor = (
            _col(COMPETITION_SESSIONS_COLLECTION)
            .find({})
            .sort("created_at", DESCENDING)
            .limit(limit)
        )
        return [_mongo_doc_to_json(d) for d in cursor]
    except PyMongoError as exc:
        print(
            f"[mongodb] WARNING: list_competition_sessions failed "
            f"({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
        return []
