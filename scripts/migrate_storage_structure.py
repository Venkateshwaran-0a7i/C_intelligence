"""
scripts/migrate_storage_structure.py
─────────────────────────────────────────────────────────────────────────────
One-shot migration: bring every existing ``product_info`` document in line
with the finalised storage schema without touching any existing values.

Changes applied (all additive only -- never overwrites):
  • is_competitor        → null   (key now always present; value unknown for legacy)
  • merged_from          → []     (no prior merge, correct neutral default)
  • needs_manual_review  → False  (product was identifiable at upload time)
  • first_uploaded_image → gridfs_id (backfilled from linked product_data)

Also creates the ``competition_sessions`` collection with indexes on
``created_at`` and ``product_ids`` if the collection does not yet exist.

Usage
-----
    uv run scripts/migrate_storage_structure.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running from repo root or from scripts/ directory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from bson import ObjectId
from src.db import _col, _get_client, PRODUCT_INFO_COLLECTION, PRODUCT_DATA_COLLECTION, MONGO_DB, _id_filter


def migrate() -> None:
    col = _col(PRODUCT_INFO_COLLECTION)

    # ── 1. Backfill is_competitor ─────────────────────────────────────────
    res_competitor = col.update_many(
        {"is_competitor": {"$exists": False}},
        {"$set": {"is_competitor": None}},
    )
    print(f"is_competitor backfilled (as null):      {res_competitor.modified_count:>6} document(s)")

    # ── 2. Backfill merged_from ───────────────────────────────────────────
    res_merged = col.update_many(
        {"merged_from": {"$exists": False}},
        {"$set": {"merged_from": []}},
    )
    print(f"merged_from backfilled (as []):           {res_merged.modified_count:>6} document(s)")

    # ── 3. Backfill needs_manual_review ──────────────────────────────────
    res_review = col.update_many(
        {"needs_manual_review": {"$exists": False}},
        {"$set": {"needs_manual_review": False}},
    )
    print(f"needs_manual_review backfilled (as False):{res_review.modified_count:>6} document(s)")

    # ── 4. Create competition_sessions collection + indexes ───────────────
    db = _get_client()[MONGO_DB]
    existing_collections = db.list_collection_names()
    if "competition_sessions" not in existing_collections:
        db.create_collection("competition_sessions")
        print("competition_sessions collection created.")
    else:
        print("competition_sessions collection already exists — skipping creation.")

    db["competition_sessions"].create_index("created_at", background=True)
    db["competition_sessions"].create_index("product_ids", background=True)
    print("Indexes ensured on competition_sessions (created_at, product_ids).")

    # ── 5. Backfill first_uploaded_image with gridfs_id ──────────────────
    # Walk every product_info doc; if first_uploaded_image is missing or
    # looks like a filename (not a 24-hex ObjectId), resolve the gridfs_id
    # from the earliest scan_history entry's product_data document and write
    # it back. Skips docs that already have a valid 24-hex gridfs_id stored.
    print("\nBackfilling first_uploaded_image with gridfs_id …")
    pd_col = _col(PRODUCT_DATA_COLLECTION)
    updated = 0
    skipped_no_image = 0
    skipped_already_ok = 0

    for info_doc in col.find({}, {"_id": 1, "first_uploaded_image": 1, "scan_history": 1}):
        current = (info_doc.get("first_uploaded_image") or "").strip()

        # Already looks like a valid ObjectId hex string — nothing to do
        if current and len(current) == 24:
            try:
                ObjectId(current)
                skipped_already_ok += 1
                continue
            except Exception:
                pass

        # Find the earliest scan (oldest analyzed_at) to get the original image
        history = sorted(
            info_doc.get("scan_history", []),
            key=lambda e: e.get("analyzed_at") or "",
        )
        gridfs_id = ""
        for entry in history:
            pd_id = entry.get("product_data_id", "")
            if not pd_id:
                continue
            pd_doc = pd_col.find_one(_id_filter(pd_id), {"metadata.images": 1})
            if pd_doc is None:
                continue
            images = (pd_doc.get("metadata") or {}).get("images", [])
            if images:
                gridfs_id = images[0].get("gridfs_id", "") or images[0].get("filename", "")
            if gridfs_id:
                break

        if not gridfs_id:
            skipped_no_image += 1
            continue

        col.update_one(
            {"_id": info_doc["_id"]},
            {"$set": {"first_uploaded_image": gridfs_id}},
        )
        updated += 1

    print(f"  first_uploaded_image updated:   {updated:>6} document(s)")
    print(f"  already had gridfs_id:          {skipped_already_ok:>6} document(s)")
    print(f"  no image found (skipped):       {skipped_no_image:>6} document(s)")

    print("\nMigration complete.")


if __name__ == "__main__":
    migrate()
