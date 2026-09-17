import sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")
from src.db import _col, _get_bucket, PRODUCT_INFO_COLLECTION
from bson import ObjectId

col = _col(PRODUCT_INFO_COLLECTION)
bucket = _get_bucket()

for doc in col.find({}, {"product_name": 1, "first_uploaded_image": 1}).limit(3):
    img_id = doc.get("first_uploaded_image", "")
    print(f"Product: {doc.get('product_name','?')[:40]}")
    print(f"  first_uploaded_image: {img_id!r}  (len={len(img_id)})")
    if img_id:
        try:
            grid_out = bucket.open_download_stream(ObjectId(img_id))
            data = grid_out.read(1)
            print(f"  GridFS: EXISTS  filename={grid_out.filename}")
        except Exception as e:
            print(f"  GridFS: ERROR — {e}")
    else:
        print("  GridFS: (no id stored)")
    print()
