# SYSTEM OBJECTIVE
Run a full verification pass against the live GptModel system, checking
every requirement and every fix made so far. For each item below, either
confirm PASS with evidence (a specific screen, response, or query
result), or report FAIL with what was actually observed. Do not mark
anything PASS based on code inspection alone if it can be checked by
actually running the flow — this is a runtime verification, not a code
review.

# TECHNICAL ENVIRONMENT
- Backend: FastAPI on :8000, MongoDB (`Competition_intelligence` +
  `lims` databases)
- Frontend: React + Vite on :5173
- Reference docs: `SYSTEM_DESIGN.md`, `collection_structure_reference.md`

---

## A. Repository (original requirement #1)

| # | Check | How to verify | Pass criteria |
|---|---|---|---|
| A1 | Product + ingredient data stored centrally | Upload a product, then `GET /products/{id}` | Full extracted JSON returned, matches what was on the package |
| A2 | Data is never deleted / immutable snapshots | Inspect `product_data` collection document count before/after a normal browsing session | Count only ever increases, never decreases from read operations |
| A3 | 6+ months retention | Query `product_data` for documents older than 6 months (if any exist) | None have been purged; no TTL index silently deleting old scans |
| A4 | Search and filter the repository | See section B | — |

## B. Search & Filters (original requirement #2)

| # | Check | Currently implemented? | Pass criteria |
|---|---|---|---|
| B1 | Business filter | Yes — dropdown in `FilterBar.tsx` | Selecting a business narrows `GET /products` results correctly |
| B2 | Division filter | Yes — free-text input | Typing a division narrows results correctly |
| B3 | Brand filter | Yes — free-text input | Typing a brand narrows results correctly |
| B4 | **Product Category filter** | **NOT FOUND in `FilterBar.tsx` or `list_products()` params** | FLAG AS GAP — confirm whether `product_category` is even queryable via `GET /products` today |
| B5 | Product / Competition Product filter | Yes — "Scope: All / Own product / Competitor" toggle | Selecting "Own product" or "Competitor" correctly filters by `is_competitor` |
| B6 | **From Date & To Date filter** | **NOT FOUND in current FilterBar** | FLAG AS GAP — `list_products()` may support `date_from`/`date_to` params server-side per earlier design, but no UI control exists to set them |
| B7 | **Period filter (preset ranges)** | **NOT FOUND** | FLAG AS GAP — no "Last 30 days / Last quarter / Last year" preset exists anywhere |
| B8 | **"Uploaded data" filter** | **Ambiguous — never clarified what this means** | FLAG AS OPEN QUESTION — confirm with the requirement source whether this means filtering by upload source (`api`/`cli`/`batch`), by whether an image exists, or something else, before implementing |
| B9 | Search box behavior | Current search is labeled "Search this page…" | CONFIRM: is this searching only the currently-loaded page of results (client-side), or the full catalogue server-side? If client-side only, this under-delivers on "search the stored data" — flag if so |

**Action needed on this section**: B4, B6, B7 are real gaps requiring
new UI (and possibly backend query params) before requirement #2 can be
called complete. B8 needs clarification before it can be verified at all.

## C. Competition Tracker (replaces original requirement #3, "Historical Comparison")

| # | Check | How to verify | Pass criteria |
|---|---|---|---|
| C1 | Periodic competition — view a product's own history over time | Open a product with 2+ scans, check Timeline tab | Every scan listed, chronological, each showing its own LIMS status |
| C2 | Each scan can carry its own independent LIMS link | Link different `sc_value`s to two different scans of the same product (per the per-timestamp fix) | Both links persist independently; viewing each scan shows its own correct parameters |
| C3 | Multi-brand competition — select 2-4 products, compare | `POST /competitions` with 2-4 `product_ids` | Session created, `snapshot_ids` populated |
| C4 | Frozen snapshots don't drift | Create a session, then upload a new scan for one of the compared products, then `GET /competitions/{id}` again | Session still shows the ORIGINAL snapshot data, unaffected by the new scan |
| C5 | Session rejects invalid product counts | `POST /competitions` with 1 or 5 product_ids | Both rejected with 422 |

## D. LIMS Integration (original requirement #4)

| # | Check | How to verify | Pass criteria |
|---|---|---|---|
| D1 | Link LIMS test results to the respective product | Use "Link a LIMS sample" on a product | `scan_history` entry gets a `lims_sc_value` |
| D2 | Store relevant LIMS and product information together | `GET /products/{id}` | Response includes both product identity AND compiled LIMS results in one payload |
| D3 | Map products with the LIMS Sample ID | Confirm the join is via `sc_value`, not free-text `description` | `link_lims_sample()` validates against `lims_sc.sc_value`, not fuzzy text matching |
| D4 | Final mapping between Business, Division, Product, and LIMS is confirmed (not guessed) | Attempt to link LIMS without explicit user action (check `auto_link_or_create_product`) | LIMS linking is NEVER automatic — always requires an explicit `POST /product-data/{id}/lims` call with a human-chosen `sc_value`; product-to-product matching MAY be automatic (score ≥ 70) but LIMS linking never is |
| D5 | LIMS results render correctly, including pending tests | Open a product whose sample has unresulted tests | Table shows "Pending" badges, not blank rows or bare test-name lists |
| D6 | LIMS join doesn't silently drop results when `lims_pg` is missing | Open the Cavin's Vanilla Milkshake / SC20260818-27 case | The "GC profile for Flavours & Seasonings" result still renders |

---

## E. Data integrity / matching safety (from the dedup work)

| # | Check | How to verify | Pass criteria |
|---|---|---|---|
| E1 | No fuzzy barcode matching in production matching logic | Inspect `find_product_candidates()` / `pair_score()` | Only exact barcode match awards points; no edit-distance logic present |
| E2 | Variant mismatch penalty active | Attempt to auto-link two same-brand, same-name, different-variant products | They do NOT merge (score drops below threshold) |
| E3 | `is_competitor` required on new products | `POST /products/confirm` with `action: create_new` and no `is_competitor` | Rejected with 422, not silently created |
| E4 | `is_competitor` never overwritten on link | Link a new scan to an existing product, passing a different `is_competitor` value | Existing product's `is_competitor` is unchanged |
| E5 | Every `product_info` doc has `first_uploaded_image`, `merged_from`, `needs_manual_review` | Sample a few documents directly from MongoDB | All three keys present on every document (null/[]/false at minimum) |

## F. Upload flow

| # | Check | How to verify | Pass criteria |
|---|---|---|---|
| F1 | Extract → auto-link/create → optional LIMS link, in one flow | Upload a new product image end-to-end | Reaches a product detail page with correct identity and (if chosen) LIMS link |
| F2 | Camera capture available | Open Upload page, click "Take photo" | Camera permission requested; captured photo added to the same file list as browsed files |
| F3 | Extraction still works via drag-and-drop / browse (regression check) | Upload via file picker | Unaffected by the camera addition |

---

# REPORTING FORMAT
For each item, report:

    [PASS] A2 — product_data count went 103 → 104 after one upload, never decreased.
    [FAIL] B4 — no Product Category control exists in FilterBar.tsx; GET /products has no product_category query param wired to the UI.
    [GAP]  B8 — "Uploaded data" filter meaning was never defined; cannot verify until clarified.

Group the final output into three lists: **Confirmed working**,
**Confirmed broken / missing**, and **Needs clarification before it can
be verified at all** — so the next work session has a clear, ordered
punch list instead of a wall of mixed results.