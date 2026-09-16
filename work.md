the competition crusher have 3 systems 
1. Competition Intelligence 
2. Competition Tracker 
3. Competition Conqueror

these three are connected to each other but they are individual systems 

PHASE 1 — Data foundation
─────────────────────────
[✓] GPT-5-mini extraction
[✓] Multi-image extraction
[✓] product_data
[✓] Finalize product_info
[✓] Duplicate/master-product linking
[✓] Scan history

PHASE 2 — LIMS
──────────────
[✓] LIMS connection
[✓] Read-only data retrieval
[✓] LIMS ID selection UI
[✓] product_info ↔ LIMS relationship

PHASE 3 — Competition Tracker
──────────────────────────────
[ ] Catalog
[ ] Same-category filtering
[ ] Product selection
[ ] Maximum 4 products
[ ] Periodic comparison
[ ] Multi-product comparison
[ ] multi_competitor persistence

PHASE 4 — AI Analysis
─────────────────────
[ ] Comparison context builder
[ ] Ingredient comparison
[ ] Nutrition comparison
[ ] Product difference analysis
[ ] LLM analysis
[ ] Recommendation generation

PHASE 5 — AI Assistant
─────────────────────
[ ] Conversation storage
[ ] Decision storage
[ ] Follow-up questions
[ ] Previous-session retrieval
[ ] Final product improvement report



























# Competition Crusher --- Complete Model, Architecture & TODO Status

> **Document purpose:** This document captures the current Competition
> Crusher architecture, model responsibilities, database structure,
> workflows, implementation status, and remaining TODOs based on the
> provided Competition Crusher flowchart and the current project
> direction discussed for the system.

------------------------------------------------------------------------

## 1. Project Overview

**Competition Crusher** is a product intelligence and competitive
analysis platform for FMCG/CPG products.

The system is divided into three major functional areas:

1.  **Competition Intelligence**
    -   Accept product packaging images.
    -   Extract structured product information.
    -   Store extracted scan data.
    -   Detect whether the product already exists.
    -   Maintain a master product record and scan history.
    -   Connect the product with a manually selected LIMS ID.
2.  **Competition Tracker**
    -   Provide a product catalog.
    -   Support periodic comparison of the same product across different
        scan timestamps.
    -   Support comparison of multiple products.
    -   Filter products to the same kind/category during competitor
        selection.
    -   Store competition sessions.
3.  **Competitions Conqueror**
    -   Read company and competitor product information.
    -   Compare ingredients and nutrition information.
    -   Use an LLM to reason over the comparison data.
    -   Generate product-improvement recommendations.
    -   Store conversations and decisions.

The supplied flowchart represents these three areas under the overall
**Competition Crusher** system.

------------------------------------------------------------------------

# 2. High-Level Architecture

``` text
                         COMPETITION CRUSHER
                                |
             +------------------+------------------+
             |                  |                  |
             v                  v                  v
   COMPETITION             COMPETITION      COMPETITIONS
   INTELLIGENCE             TRACKER          CONQUEROR
             |                  |                  |
             v                  v                  v
       Image/Data          Product Catalog     Product Data
        Extraction          & Comparison          +
             |                  |             Product Info
             v                  v                  |
        MongoDB            Comparison             v
      product_data         Sessions             LLM
             |                  |                  |
             v                  v                  v
        product_info      multi_competitor    Insights &
             |                                Recommendations
             v
           LIMS
```

------------------------------------------------------------------------

# 3. Model / AI Components

## 3.1 GPT-5-mini --- Product Extraction Model

### Responsibility

GPT-5-mini is the primary model used for extracting structured product
information from uploaded packaging images.

### Input

The system can receive multiple images belonging to the same product:

``` text
Front image
Back image
Side image
Nutrition panel
Ingredients panel
Other packaging images
```

### Processing concept

``` text
Uploaded Images
      |
      v
Image validation
      |
      v
GPT-5-mini
      |
      v
OCR + visual understanding
      |
      v
Structured product information
      |
      v
Validation / normalization
      |
      v
product_data
```

### Important requirement

Multiple images of the same physical product must be treated as **one
product scan**, not as multiple products.

Examples:

``` text
2 images  -> 1 product
4 images  -> 1 product
5 images  -> 1 product
6 images  -> 1 product
```

The model/system should merge information across images and avoid
duplicating fields.

------------------------------------------------------------------------

# 4. Product Extraction Data

The extracted product information can contain fields such as:

-   Product name
-   Brand
-   Business
-   Division
-   Category
-   Subcategory
-   Variant
-   SKU / Pack
-   Grammage
-   Front claims
-   Back claims
-   Ingredients
-   Nutrition
-   Manufacturer
-   Manufacturer address
-   Usage instructions
-   Storage instructions
-   Product summary
-   Experience
-   Manufacturing date
-   Best-before date
-   Expiry date
-   MRP
-   Batch
-   Barcode
-   Confidence values

The extraction layer should preserve the source of information and
confidence wherever applicable.

------------------------------------------------------------------------

# 5. Competition Intelligence

## 5.1 Image Upload

### Workflow

``` text
User
 |
 v
Upload product image(s)
 |
 v
Image processing
 |
 v
GPT-5-mini
 |
 v
Extracted product data
 |
 v
MongoDB
```

### Status

**Current status: DONE / CORE IMPLEMENTED**

### Remaining work

-   Strengthen multi-image validation.
-   Detect different products accidentally uploaded together.
-   Improve field-level confidence.
-   Handle missing/blurred/occluded information.
-   Validate the final structured response against the expected schema.
-   Ensure no fabricated values are accepted.

------------------------------------------------------------------------

# 6. `product_data`

## Purpose

`product_data` should represent an individual product scan/extraction.

A scan is a snapshot of the product at a particular time.

Conceptually:

``` text
product_data
 |
 +-- scan 1
 +-- scan 2
 +-- scan 3
 +-- scan 4
```

Each scan can contain:

-   Extracted product information
-   Image references
-   Scan timestamp
-   Model/extraction metadata
-   Confidence information
-   Product identification information

### Status

**DONE / IN USE**

### TODO

-   Finalize schema.
-   Add strong timestamps.
-   Add scan identifiers.
-   Add image references.
-   Add extraction metadata.
-   Add indexes for product lookup.
-   Add duplicate/matching metadata.
-   Ensure historical scans are immutable where appropriate.

------------------------------------------------------------------------

# 7. Duplicate / Existing Product Detection

After extracting a product, the system checks whether the product
already exists in `product_data`.

Flow:

``` text
New Scan
   |
   v
Search product_data
   |
   +------------------+
   |                  |
   v                  v
Existing            New
product             product
   |                  |
   v                  v
Link/update         Create
master product      master product
```

The flowchart explicitly contains an automated check to determine
whether uploaded product data is already present in `product_data`.

### Status

**PARTIAL**

### TODO

Implement reliable matching using appropriate product identifiers and
extracted attributes.

Potential matching signals:

``` text
Barcode
SKU
Brand + Product Name
Brand + Product Name + Variant
Pack/Grammage
Normalized ingredient information
Manufacturer
Other stable product identifiers
```

The system should distinguish:

``` text
Same product
Same brand but different variant
Similar product
Different product
Unknown
```

Do not treat visual similarity alone as proof that two products are the
same product.

------------------------------------------------------------------------

# 8. `product_info` --- Master Product Record

## Purpose

`product_info` should be the master-level product entity.

The flowchart describes `product_info` as the place where the product
information is maintained across scans/timestamps and where the LIMS ID
can be associated.

Recommended conceptual relationship:

``` text
                    product_info
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
     Scan 1           Scan 2           Scan 3
        |                |                |
        v                v                v
 product_data       product_data      product_data
```

### Important principle

`product_info` = **master product**

`product_data` = **individual scan/snapshot**

This distinction is important for periodic comparison.

------------------------------------------------------------------------

# 9. Recommended `product_info` Structure

Conceptually:

``` json
{
  "_id": "master_product_id",
  "product_name": "...",
  "brand": "...",
  "business": "...",
  "division": "...",
  "category": "...",
  "subcategory": "...",
  "variant": "...",
  "lims_id": "...",

  "scan_history": [
    {
      "product_data_id": "...",
      "scanned_at": "...",
      "image_ids": []
    }
  ],

  "latest_scan": {
    "product_data_id": "...",
    "scanned_at": "..."
  }
}
```

This is an architectural recommendation for implementing the flow shown
in the diagram. The exact production schema still needs to be finalized.

------------------------------------------------------------------------

# 10. New Product Flow

When a product is scanned for the first time:

``` text
Image(s)
   |
   v
GPT-5-mini extraction
   |
   v
product_data created
   |
   v
Existing product check
   |
   v
No existing master product
   |
   v
Create product_info
   |
   v
LIMS ID not linked yet
   |
   v
User selects LIMS ID
```

### Status

**PARTIAL**

### TODO

-   Create master product automatically.
-   Link `product_data` to `product_info`.
-   Preserve scan timestamp.
-   Provide catalog UI.
-   Allow manual LIMS ID selection.
-   Validate selected LIMS ID.

------------------------------------------------------------------------

# 11. Existing Product Flow

When the scanned product already exists:

``` text
New Scan
   |
   v
product_data
   |
   v
Existing product detected
   |
   v
Find corresponding product_info
   |
   v
Add new product_data reference
   |
   v
Update latest_scan
```

The flowchart describes adding the `product_data` product ID to the
existing `product_info` document.

### Status

**PARTIAL**

### TODO

-   Implement robust master-product lookup.
-   Append scan reference.
-   Update latest scan.
-   Preserve previous scans.
-   Avoid overwriting historical scan information.
-   Handle duplicate image uploads.

------------------------------------------------------------------------

# 12. LIMS Integration

The flowchart separates the Competition Intelligence database from the
LIMS database.

Conceptually:

``` text
Competition_Intelligence
        |
        +-- product_data
        |
        +-- product_info
                 |
                 | LIMS ID
                 v
              LIMS DB
                 |
          +------+------+ 
          |      |      |
          v      v      v
       lims_sc lims_pa lims_pg
```

The diagram shows the LIMS database containing:

-   `lims_sc`
-   `lims_pa`
-   `lims_pg`

and indicates a read-only relationship from the competition intelligence
side.

### Status

**PARTIAL**

### TODO

-   Establish the production LIMS connection.
-   Confirm the actual schemas.
-   Confirm which collection/table contains the required LIMS ID.
-   Implement read-only access.
-   Build LIMS search.
-   Build LIMS selection UI.
-   Store the selected LIMS ID in `product_info`.
-   Validate that the selected LIMS ID is valid.

------------------------------------------------------------------------

# 13. Master Accessing Tool

The flowchart includes a **Master accessing tool** connected to the
Competition Intelligence and LIMS data structure.

### Intended responsibility

Provide a controlled way for the application to access the master
product and related LIMS information.

Possible responsibilities:

``` text
Product lookup
Master product retrieval
Latest scan retrieval
Historical scan retrieval
LIMS mapping retrieval
Comparison data preparation
```

### Status

**TODO**

------------------------------------------------------------------------

# 14. Competition Tracker

The Competition Tracker is the comparison/navigation layer.

The flowchart divides it into:

``` text
Competition Tracker
       |
       +----------------------+
       |                      |
       v                      v
Periodic Competition    Multiple Product
                         Competition
```

------------------------------------------------------------------------

# 15. Product Catalog

The catalog should use `product_info` as the master product list.

Each catalog item represents a product rather than an individual
historical scan.

Conceptually:

``` text
Catalog
 |
 +-- Product A
 +-- Product B
 +-- Product C
 +-- Product D
```

Selecting a product should allow access to:

-   Product details
-   Latest scan
-   Historical scans
-   LIMS mapping
-   Competition comparison

### Status

**PARTIAL**

### TODO

-   Complete catalog UI.
-   Search.
-   Filter.
-   Category filtering.
-   Brand filtering.
-   Product-type filtering.
-   Latest scan display.
-   Product selection.
-   Product detail page.

------------------------------------------------------------------------

# 16. Periodic Competition

## Purpose

Compare the same product across different scan timestamps.

The flowchart describes:

``` text
Periodic Competition
       |
       v
product_info
       |
       v
Historical product scans
       |
       v
Select product
       |
       v
Compare periodic changes
```

### Example

``` text
Chocolate Milkshake

January Scan
     |
     v
April Scan
     |
     v
August Scan
```

The system can identify changes in extracted product information.

Possible comparison fields:

``` text
Ingredients
Nutrition
Claims
Pack size
Grammage
MRP
Variant
Manufacturer
Storage instructions
Usage instructions
Other extracted fields
```

### Status

**TODO / EARLY STAGE**

------------------------------------------------------------------------

# 17. Periodic Comparison Output

A useful result structure could be:

``` text
PRODUCT
Chocolate Milkshake

PERIOD
January 2026 -> August 2026

CHANGES

Ingredients
- Changed

Nutrition
- Energy changed
- Sugar changed

Claims
- Claim changed

Packaging
- Pack size unchanged

Commercial
- MRP changed
```

The exact business rules for what counts as a significant change still
need to be defined.

------------------------------------------------------------------------

# 18. Multiple Product Competition

## Purpose

Compare up to four products.

The flowchart specifies a maximum of four products for a competition
session.

### Intended workflow

``` text
Product Catalog
       |
       v
Select Product A
       |
       v
Catalog filters to same kind/category
       |
       v
Select Product B
       |
       v
Select Product C
       |
       v
Select Product D
       |
       v
Maximum 4 products
       |
       v
Compare
       |
       v
Store session
```

### Status

**PARTIAL**

------------------------------------------------------------------------

# 19. Same-Category Filtering

After selecting a product, the catalog should automatically restrict
available competitor choices to products of the same kind.

Example:

``` text
Selected:
Chocolate Milkshake

Available:
✓ Chocolate Milkshake — Brand A
✓ Chocolate Milkshake — Brand B
✓ Chocolate Milkshake — Brand C

Filtered out:
✗ Shampoo
✗ Hair Dye
✗ Fruit Juice
✗ Plain Milk
```

The exact matching hierarchy should be finalized.

Potential hierarchy:

``` text
Category
   |
   v
Subcategory
   |
   v
Product type
   |
   v
Variant
```

### Status

**TODO**

------------------------------------------------------------------------

# 20. Maximum Four Product Rule

The competition session should enforce:

``` text
Minimum: project-defined
Maximum: 4 products
```

UI concept:

``` text
Selected products: 3 / 4

[Product A] [Remove]
[Product B] [Remove]
[Product C] [Remove]

[Add competitor]

[COMPARE]
```

If four are selected:

``` text
4 / 4

Additional selection disabled
```

### Status

**TODO / PARTIAL**

------------------------------------------------------------------------

# 21. `multi_competitor`

The flowchart specifies:

``` text
Competition_Intelligence
       |
       v
multi_competitor
       |
       v
Competition sessions
```

## Purpose

Store the comparison session rather than only storing the final LLM
answer.

Recommended conceptual structure:

``` json
{
  "_id": "comparison_session_id",
  "comparison_type": "multi_product",
  "product_info_ids": [
    "product_a",
    "product_b",
    "product_c"
  ],
  "created_at": "...",
  "updated_at": "...",
  "analysis": {},
  "conversation_id": "..."
}
```

### Status

**PARTIAL**

### TODO

-   Finalize schema.
-   Store selected product IDs.
-   Store comparison type.
-   Store timestamp.
-   Store analysis reference.
-   Store conversation reference.
-   Add session retrieval.
-   Add previous-session view.

------------------------------------------------------------------------

# 22. Competitions Conqueror

This is the intelligence/reasoning layer.

Its responsibility is to use structured competition data and generate
useful analysis.

The flowchart describes two primary inputs:

``` text
product_info
product_data
```

The LLM reads this information to understand:

``` text
Company products
Competitor products
Ingredients
Nutrition
Product differences
```

Then produces product-improvement-oriented output.

------------------------------------------------------------------------

# 23. Competitions Conqueror --- Data Flow

``` text
                   MongoDB
                      |
        +-------------+-------------+
        |                           |
        v                           v
  product_info                product_data
        |                           |
        +-------------+-------------+
                      |
                      v
             Comparison Context
                      |
                      v
                     LLM
                      |
          +-----------+-----------+
          |                       |
          v                       v
   Product Analysis       Recommendations
          |                       |
          +-----------+-----------+
                      |
                      v
               Conversation
                  / Decision
                      |
                      v
                  MongoDB
```

------------------------------------------------------------------------

# 24. Comparison Context Builder

The LLM should not be given unnecessary raw database information.

Instead, create a structured comparison context.

Example:

``` json
{
  "comparison_session_id": "...",

  "company_products": [
    {
      "product_info_id": "...",
      "latest_product_data_id": "...",
      "product_name": "...",
      "ingredients": [],
      "nutrition": {}
    }
  ],

  "competitor_products": [
    {
      "product_info_id": "...",
      "latest_product_data_id": "...",
      "product_name": "...",
      "ingredients": [],
      "nutrition": {}
    }
  ]
}
```

### Status

**TODO**

------------------------------------------------------------------------

# 25. Ingredient Comparison

The analysis layer should compare ingredient information between
selected products.

Potential outputs:

``` text
Common ingredients
Unique ingredients
Ingredients present only in company product
Ingredients present only in competitor product
Ingredient order differences
Functional ingredients
Sweeteners
Stabilizers
Preservatives
Flavours
Colours
Other declared ingredients
```

### Important principle

The LLM should distinguish between:

``` text
Observed from label
Inference
Possible explanation
Recommendation
```

It should not present an inferred formulation purpose as if it were
explicitly stated on the product label.

### Status

**TODO**

------------------------------------------------------------------------

# 26. Nutrition Comparison

The comparison layer should normalize comparable nutrition fields before
analysis.

Potential fields:

``` text
Serving size
Energy
Protein
Carbohydrate
Total sugars
Added sugars
Fat
Saturated fat
Trans fat
Sodium
Other available nutrients
```

### Status

**TODO**

------------------------------------------------------------------------

# 27. Product Improvement Analysis

The flowchart expects the system to generate recommendations around
ingredients/chemicals and ways to improve products.

A safer and more useful output structure is:

``` text
1. Observation
2. Evidence from product data
3. Difference from competitor
4. Possible interpretation
5. Area for investigation
6. Suggested improvement direction
```

Example structure:

``` text
Observation:
Competitor product declares ingredient X while company product does not.

Evidence:
Ingredient X appears in the competitor label.

Possible interpretation:
Ingredient X may serve a functional purpose, but the label alone
does not establish the exact formulation objective.

Investigation:
R&D can evaluate whether the ingredient/function is relevant.

Suggested direction:
Evaluate the formulation requirement and applicable product constraints
before considering a formulation change.
```

### Status

**TODO**

------------------------------------------------------------------------

# 28. Conversation Storage

The flowchart includes storing conversations and decisions.

A dedicated conversation structure can contain:

``` json
{
  "conversation_id": "...",
  "comparison_session_id": "...",
  "messages": [
    {
      "role": "user",
      "content": "..."
    },
    {
      "role": "assistant",
      "content": "..."
    }
  ],
  "decisions": [],
  "created_at": "...",
  "updated_at": "..."
}
```

### Status

**TODO**

------------------------------------------------------------------------

# 29. Decision Storage

Decisions should be associated with the comparison session.

Possible structure:

``` json
{
  "decision_id": "...",
  "comparison_session_id": "...",
  "decision": "...",
  "reason": "...",
  "created_at": "..."
}
```

### Status

**TODO**

------------------------------------------------------------------------

# 30. Complete Database Architecture

``` text
Competition_Intelligence
|
+-- product_data
|     |
|     +-- individual scan
|     +-- extracted data
|     +-- images
|     +-- timestamp
|     +-- extraction metadata
|
+-- product_info
|     |
|     +-- master product
|     +-- LIMS ID
|     +-- scan history
|     +-- latest scan
|     +-- product_data references
|
+-- multi_competitor
|     |
|     +-- comparison sessions
|     +-- selected products
|     +-- comparison metadata
|
+-- conversations
|     |
|     +-- user questions
|     +-- AI responses
|     +-- decisions
|
+-- analysis / AI results
      |
      +-- ingredient analysis
      +-- nutrition analysis
      +-- recommendations
```

LIMS remains a separate data source:

``` text
LIMS Database
|
+-- lims_sc
+-- lims_pa
+-- lims_pg
```

------------------------------------------------------------------------

# 31. End-to-End Product Lifecycle

``` text
STEP 1
User uploads product images
        |
        v
STEP 2
Validate images
        |
        v
STEP 3
GPT-5-mini extracts product information
        |
        v
STEP 4
Normalize and validate extracted data
        |
        v
STEP 5
Create product_data scan
        |
        v
STEP 6
Check whether product already exists
        |
        +-----------------------------+
        |                             |
        v                             v
    Existing                      New Product
        |                             |
        v                             v
Find product_info             Create product_info
        |                             |
        +-------------+---------------+
                      |
                      v
STEP 7
Link product_data -> product_info
                      |
                      v
STEP 8
User selects LIMS ID
                      |
                      v
STEP 9
Product appears in catalog
                      |
                      v
STEP 10
User starts competition
                      |
             +--------+--------+
             |                 |
             v                 v
       Periodic             Multi-product
       comparison           comparison
             |                 |
             +--------+--------+
                      |
                      v
STEP 11
Create comparison session
                      |
                      v
STEP 12
Build comparison context
                      |
                      v
STEP 13
LLM analysis
                      |
          +-----------+-----------+
          |                       |
          v                       v
    Comparison                 Product
     insights               improvement
                           recommendations
          |                       |
          +-----------+-----------+
                      |
                      v
STEP 14
Store conversation / decisions
```

------------------------------------------------------------------------

# 32. Current TODO Status

## Status Legend

``` text
🟢 DONE
🟡 PARTIAL
🔴 TODO
```

------------------------------------------------------------------------

## 32.1 Competition Intelligence

  Task                                      Status
  ----------------------------------------- ---------------------
  Image upload                              🟢 DONE
  Multi-image input                         🟢 DONE / CORE
  GPT-5-mini integration                    🟢 DONE
  Structured extraction                     🟢 DONE
  Product schema                            🟢 DONE / ITERATING
  MongoDB storage                           🟢 DONE
  `product_data`                            🟢 DONE
  Duplicate detection                       🟡 PARTIAL
  New product detection                     🟡 PARTIAL
  `product_info`                            🟡 PARTIAL
  Scan history                              🟡 PARTIAL
  `product_data` → `product_info` linking   🟡 PARTIAL
  Latest scan logic                         🟡 PARTIAL
  LIMS ID selection                         🟡 PARTIAL
  LIMS validation                           🔴 TODO

------------------------------------------------------------------------

## 32.2 Database / LIMS

  Task                          Status
  ----------------------------- ------------
  Competition Intelligence DB   🟢 DONE
  `product_data`                🟢 DONE
  `product_info`                🟡 PARTIAL
  `multi_competitor`            🟡 PARTIAL
  LIMS database connection      🟡 PARTIAL
  `lims_sc` access              🟡 PARTIAL
  `lims_pa` access              🟡 PARTIAL
  `lims_pg` access              🟡 PARTIAL
  Read-only integration         🟡 PARTIAL
  Master accessing tool         🔴 TODO

------------------------------------------------------------------------

## 32.3 Competition Tracker

  Task                             Status
  -------------------------------- ------------
  Product catalog                  🟡 PARTIAL
  Product selection                🟡 PARTIAL
  Product search                   🟡 PARTIAL
  Category filtering               🔴 TODO
  Same-product-type filtering      🔴 TODO
  Maximum 4 products               🟡 PARTIAL
  Multi-product comparison UI      🔴 TODO
  Periodic comparison              🔴 TODO
  Historical scan comparison       🔴 TODO
  Comparison session creation      🟡 PARTIAL
  `multi_competitor` persistence   🟡 PARTIAL
  Previous comparison retrieval    🔴 TODO

------------------------------------------------------------------------

## 32.4 Competitions Conqueror

  Task                                Status
  ----------------------------------- ---------
  Read `product_info`                 🔴 TODO
  Read `product_data`                 🔴 TODO
  Comparison context builder          🔴 TODO
  Company product identification      🔴 TODO
  Competitor product identification   🔴 TODO
  Ingredient comparison               🔴 TODO
  Nutrition comparison                🔴 TODO
  Product difference analysis         🔴 TODO
  LLM reasoning layer                 🔴 TODO
  Improvement recommendations         🔴 TODO
  Conversation storage                🔴 TODO
  Decision storage                    🔴 TODO
  Previous conversation retrieval     🔴 TODO

------------------------------------------------------------------------

# 33. Development Priority

The recommended implementation sequence is:

## Phase 1 --- Stabilize Data Foundation

``` text
[✓] GPT-5-mini extraction
[✓] Multi-image extraction
[✓] product_data
[ ] Finalize product_info
[ ] Duplicate/master-product matching
[ ] product_data -> product_info relationship
[ ] Scan history
[ ] Latest scan logic
```

### Goal

Create a reliable master product catalog with historical scans.

------------------------------------------------------------------------

# 34. Phase 2 --- LIMS Integration

``` text
[ ] Connect LIMS
[ ] Read LIMS data
[ ] Search LIMS
[ ] Select LIMS ID
[ ] Validate LIMS ID
[ ] Store LIMS ID in product_info
[ ] Build master access layer
```

### Goal

Every master product can optionally be mapped to the correct LIMS
product.

------------------------------------------------------------------------

# 35. Phase 3 --- Competition Tracker

``` text
[ ] Product catalog
[ ] Product selection
[ ] Category filtering
[ ] Same-product-type filtering
[ ] Maximum 4 products
[ ] Periodic comparison
[ ] Multi-product comparison
[ ] Comparison session
[ ] multi_competitor persistence
```

### Goal

Users can select products and create repeatable competition sessions.

------------------------------------------------------------------------

# 36. Phase 4 --- Competitions Conqueror

``` text
[ ] Comparison context builder
[ ] Ingredient comparison
[ ] Nutrition comparison
[ ] Product difference analysis
[ ] LLM analysis
[ ] Recommendation generation
[ ] Evidence-aware output
```

### Goal

Turn structured competition data into useful analysis.

------------------------------------------------------------------------

# 37. Phase 5 --- AI Assistant and History

``` text
[ ] Conversation storage
[ ] Decision storage
[ ] Follow-up questions
[ ] Previous-session retrieval
[ ] Context-aware conversation
[ ] Final analysis/report
```

### Goal

Turn the comparison system into a persistent research assistant.

------------------------------------------------------------------------

# 38. Recommended Backend Service Boundaries

A clean backend can be divided conceptually into:

``` text
backend/
|
+-- extraction/
|     +-- image handling
|     +-- GPT-5-mini
|     +-- schema validation
|
+-- products/
|     +-- product_data
|     +-- product_info
|     +-- matching
|     +-- scan history
|
+-- lims/
|     +-- connection
|     +-- search
|     +-- mapping
|
+-- competition/
|     +-- catalog
|     +-- filtering
|     +-- periodic comparison
|     +-- multi-product comparison
|
+-- analysis/
|     +-- context builder
|     +-- ingredient analysis
|     +-- nutrition analysis
|     +-- LLM analysis
|     +-- recommendations
|
+-- conversations/
|     +-- messages
|     +-- decisions
|
+-- database/
      +-- MongoDB
      +-- repositories
```

This is an implementation organization recommendation; the supplied
flowchart does not prescribe this exact folder structure.

------------------------------------------------------------------------

# 39. API-Level TODO

A possible API surface:

## Extraction

``` text
POST /extract
GET  /health
```

## Products

``` text
GET  /products
GET  /products/{id}
POST /products/scan
GET  /products/{id}/history
```

## LIMS

``` text
GET /lims/search
GET /lims/{id}
POST /products/{id}/lims
```

## Competition

``` text
POST /competition/sessions
GET  /competition/sessions
GET  /competition/sessions/{id}
POST /competition/periodic
POST /competition/compare
```

## AI

``` text
POST /analysis/{session_id}
GET  /analysis/{session_id}
POST /conversations/{session_id}/messages
GET  /conversations/{session_id}
```

These endpoints are proposed API organization, not endpoints explicitly
specified in the flowchart.

------------------------------------------------------------------------

# 40. Important Data Rules

## Rule 1 --- One physical product scan can contain many images

``` text
Many images
     |
     v
One extraction
     |
     v
One product_data scan
```

------------------------------------------------------------------------

## Rule 2 --- Historical scans should not be destroyed

``` text
product_info
     |
     +-- old scan
     +-- old scan
     +-- latest scan
```

Historical information is required for periodic comparison.

------------------------------------------------------------------------

## Rule 3 --- `product_info` is the master product

Use it for catalog-level identity.

Use `product_data` for scan-level snapshots.

------------------------------------------------------------------------

## Rule 4 --- Latest scan is used for current competition

For a multi-product competition:

``` text
product_info
      |
      v
latest product_data
      |
      v
competition
```

Historical scans remain available for periodic comparison.

------------------------------------------------------------------------

## Rule 5 --- Comparison sessions should reference products

A session should reference stable product/master IDs rather than copying
the entire product database into every session.

------------------------------------------------------------------------

## Rule 6 --- LLM should receive prepared context

Prefer:

``` text
MongoDB
   |
   v
Backend context builder
   |
   v
Structured comparison context
   |
   v
LLM
```

rather than:

``` text
MongoDB
   |
   v
Entire database -> LLM
```

------------------------------------------------------------------------

# 41. Model Responsibility Separation

The system should maintain a clear separation between extraction and
reasoning.

``` text
GPT-5-mini
     |
     | "What does the product label say?"
     v
Structured Product Data
     |
     v
Comparison Engine
     |
     | "What changed / what differs?"
     v
Comparison Context
     |
     v
LLM
     |
     | "What does this information mean and
     |  what should the user investigate?"
     v
Analysis + Recommendations
```

This prevents the reasoning model from becoming the source of basic
product facts.

------------------------------------------------------------------------

# 42. Extraction vs Comparison vs Reasoning

  -----------------------------------------------------------------------
  Layer                   Main Question           Primary Responsibility
  ----------------------- ----------------------- -----------------------
  Extraction              What is on the package? GPT-5-mini + processing

  Storage                 What did we scan?       MongoDB

  Mastering               Which scans belong to   Matching logic
                          the same product?       

  Periodic comparison     What changed over time? Comparison engine

  Multi-product           How do selected         Comparison engine
  comparison              products differ?        

  Reasoning               What could the          LLM
                          differences mean?       

  Recommendation          What should R&D         LLM + business rules
                          investigate?            

  History                 What was                Conversation/decision
                          discussed/decided?      storage
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 43. Major Remaining Risks / Open Questions

These items need explicit decisions before the final architecture is
considered complete.

## Product Identity

-   What exact fields determine that two scans are the same product?
-   What happens if the barcode is unavailable?
-   How should renamed/reformulated products be handled?
-   What confidence threshold is required for automatic matching?

## Latest Scan

-   Is the latest scan always based on timestamp?
-   What happens when scans are uploaded out of order?
-   Can a scan be manually marked as invalid?

## LIMS

-   Which LIMS source is authoritative?
-   Which field is the LIMS product ID?
-   Is the LIMS connection always read-only?
-   Can one master product map to multiple LIMS records?

## Competition Filtering

-   Category only?
-   Category + subcategory?
-   Product type?
-   Variant?
-   Brand-independent matching?

## AI Analysis

-   Which model should be used for reasoning?
-   Which information must be treated as factual?
-   Which recommendations require R&D validation?
-   What evidence should be displayed alongside every recommendation?

------------------------------------------------------------------------

# 44. Definition of Done

The system can be considered functionally complete when this workflow
works end-to-end:

``` text
1. User uploads 2–8 images
          |
2. Images are validated
          |
3. GPT-5-mini extracts product information
          |
4. One consolidated product_data scan is created
          |
5. Existing product is detected
          |
6. product_info is created or updated
          |
7. Scan is added to history
          |
8. User maps/selects LIMS ID
          |
9. Product appears in catalog
          |
10. User selects a product
          |
11. Catalog filters relevant competitor products
          |
12. User selects up to 4 products
          |
13. Competition session is created
          |
14. Latest product data is prepared
          |
15. Ingredients and nutrition are compared
          |
16. LLM receives structured comparison context
          |
17. Analysis is generated
          |
18. Product-improvement recommendations are generated
          |
19. Conversation is stored
          |
20. Decisions are stored
          |
21. User can reopen the competition session
```

------------------------------------------------------------------------

# 45. Final Project Status Summary

## Currently strongest area

**Competition Intelligence / Product Extraction**

``` text
Image
  -> GPT-5-mini
  -> Structured extraction
  -> MongoDB
```

This is the foundation of the system.

## Main unfinished foundation

**Master Product Architecture**

``` text
product_data
      |
      v
product_info
      |
      v
scan history
      |
      v
LIMS mapping
```

This should be stabilized before building advanced competition analysis.

## Main functional work remaining

**Competition Tracker**

``` text
Catalog
 -> Product selection
 -> Filtering
 -> Periodic comparison
 -> Multi-product comparison
 -> Session storage
```

## Main AI work remaining

**Competitions Conqueror**

``` text
product_info
+
product_data
      |
      v
comparison context
      |
      v
LLM
      |
      v
analysis
+
recommendations
+
conversation
```

------------------------------------------------------------------------

# 46. Master TODO Checklist

## Data Extraction

-   [x] Image upload
-   [x] GPT-5-mini integration
-   [x] Structured extraction
-   [x] Multi-image extraction
-   [x] MongoDB storage
-   [ ] Strong product identity matching
-   [ ] Different-product detection
-   [ ] Field-level validation
-   [ ] Confidence handling

## Product Mastering

-   [ ] Finalize `product_info`
-   [ ] Link scans
-   [ ] Maintain scan history
-   [ ] Maintain latest scan
-   [ ] Handle duplicate scans
-   [ ] Handle product updates

## LIMS

-   [ ] Connect LIMS
-   [ ] Read LIMS data
-   [ ] Search LIMS
-   [ ] Select LIMS ID
-   [ ] Validate LIMS ID
-   [ ] Save mapping
-   [ ] Build master access layer

## Catalog

-   [ ] Product list
-   [ ] Search
-   [ ] Filters
-   [ ] Product detail
-   [ ] Latest scan
-   [ ] Scan history
-   [ ] LIMS mapping status

## Competition Tracker

-   [ ] Select product
-   [ ] Same-category filtering
-   [ ] Same-product-type filtering
-   [ ] Select competitor
-   [ ] Maximum 4 products
-   [ ] Periodic comparison
-   [ ] Multi-product comparison
-   [ ] Comparison session
-   [ ] Previous session retrieval

## Competitions Conqueror

-   [ ] Data retrieval
-   [ ] Context builder
-   [ ] Ingredient comparison
-   [ ] Nutrition comparison
-   [ ] Difference analysis
-   [ ] LLM reasoning
-   [ ] Evidence-aware output
-   [ ] Improvement recommendations
-   [ ] Conversation storage
-   [ ] Decision storage
-   [ ] Follow-up questions

## Production Readiness

-   [ ] Error handling
-   [ ] Logging
-   [ ] API validation
-   [ ] MongoDB indexes
-   [ ] Authentication/authorization if required
-   [ ] LIMS access controls
-   [ ] Model timeout/retry handling
-   [ ] Cost monitoring
-   [ ] Audit trail
-   [ ] Testing
-   [ ] End-to-end testing
-   [ ] Deployment configuration

------------------------------------------------------------------------

# 47. One-Line Architecture

``` text
IMAGE -> GPT-5-mini -> product_data -> product_info -> LIMS -> CATALOG -> COMPARISON SESSION -> COMPARISON ENGINE -> LLM -> INSIGHTS/RECOMMENDATIONS -> CONVERSATION & DECISION HISTORY
```

------------------------------------------------------------------------

## Source Basis

This document is based primarily on the supplied **Competition Crusher
Flowchart**, which defines the Competition Intelligence, Competition
Tracker, Competitions Conqueror, MongoDB, LIMS, product scan, periodic
comparison, multi-product comparison, and recommendation flows.

Where this document uses recommended schemas, API organization, folder
organization, or implementation sequencing, those are explicitly
presented as implementation recommendations rather than claims that they
are already present in the flowchart.