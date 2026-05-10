# Frontend → Backend contract notes

The backend's authoritative contract lives at `backend/API_CONTRACT.md`. This
file captures decisions that affect how the frontend uses those endpoints.

## `GET /products` — fetched once, then everything is client-side

The marketplace listing page calls `GET /products` exactly once on mount with
`limit=60` (no `category`, `vendor`, `q`, `sort`, or `offset`). All filtering,
sorting, searching, and grouping (grid / by vendor / by category) happens in
the browser against the cached response.

Implications for the backend:

- Multi-value `category` / `vendor` params are **not** required.
- `q`, `sort`, and pagination params on `/products` are not exercised by the
  marketplace listing page.
- The backend should still be capable of returning the full catalogue in one
  page (i.e. seed size ≤ `limit` cap of 60). If the catalogue grows past 60,
  the frontend strategy needs to be revisited.

Other endpoints (`GET /products/:id`, `GET /vendors`, `GET /categories`) are
used as documented in `backend/API_CONTRACT.md`.

## `POST /ai/nudges` — REMOVED (2026-05-10)

The nudges feature has been removed in favour of natural-language search
(see below). The FE can delete:
- The event tracker / buffer / flush loop.
- The toast rendering for nudges.
- The `session_id` localStorage entry (no longer used by the backend).

Any call to `POST /ai/nudges` now returns 404.

## `POST /products/search` — natural-language search (NEW)

Replaces the nudges experiment. The buyer types a query like:

> "Show me Y2K denim bundles under £8 per piece from European vendors, grade A only."

The backend asks OpenAI to translate that into a structured filter
(category, vendor country list, grade, price-per-piece cap, etc.),
validates every field against the live catalogue, runs a SQL query against
the products table, and returns both the **parsed filter** (so the FE can
show "we understood …") and the matching products in the same shape as
`GET /products`.

### Request

`POST /products/search`

```json
{ "query": "Y2K denim under £8/piece from European vendors, grade A", "limit": 24 }
```

- `query` is required, trimmed, max 300 chars.
- `limit` is optional, 1–60, defaults to 24.
- No auth required.

### Response

```json
{
  "query": "...",
  "parsed": {
    "category_slug": "y2k-streetwear",
    "vendor_slug": null,
    "vendor_countries": ["GB", "TR"],
    "brand_contains": null,
    "grade": "Grade A",
    "free_text": null,
    "max_price_per_piece": 800,
    "min_price_per_piece": null,
    "max_total_price": null,
    "min_total_price": null,
    "min_piece_count": null,
    "max_piece_count": null,
    "sort": "newest"
  },
  "products": [ /* same shape as GET /products items */ ],
  "total": 3,
  "limit": 24
}
```

- All money in `parsed` is integer pence (`max_price_per_piece: 800` = £8).
- `parsed.*` fields not implied by the query are `null` (or `[]` for `vendor_countries`).
- `parsed.sort` is one of `newest | price_asc | price_desc | price_per_piece_asc | price_per_piece_desc`.
- Failures: `400` for empty query, `502` if OpenAI couldn't produce a valid
  filter, `503` if AI/DB isn't configured.

### Suggested FE usage

- A search box on the homepage and/or `/products` page.
- After submit, show a small "Understood as: Y2K Streetwear · ≤ £8/piece · Grade A · Vendors in GB, TR" chip row built from `parsed` so the user sees what the model did, and can clear it if it misread them.
- If `products.length === 0`, suggest dropping the most specific `parsed` constraint.

## Efficiency asks (open, backend changes)

The frontend audit (2026-05-10) flagged two endpoint behaviours that the FE
can't fix on its own. None of these are blockers — calling out so the backend
agent can pick them up.

### 1. Bundle `/reviews` into the initial boot, or expose a combined endpoint

Today the home page fires `GET /reviews` in a separate effect on mount, while
`loadCatalog` already fetches `/products`, `/categories`, and `/vendors` in
parallel at App init. Reviews are site-wide (no `product_id`) and small, so:

- **Preferred:** add reviews to a combined `GET /bootstrap` (or `/home`)
  endpoint that returns `{ products, categories, vendors, reviews }` in one
  round-trip. The FE would replace four parallel requests with one.
- **Or:** leave `/reviews` as a separate endpoint but make it cache-friendly
  (`Cache-Control: public, max-age=300`) so repeat home visits don't re-hit
  the DB.

### 2. `GET /orders` should accept `limit` / `offset`

Currently `GET /orders` returns every order for the authed user, unbounded.
For a power user this grows linearly forever. Please add:

- `limit` (default 20, max 60)
- `offset` (default 0)
- Response includes `total` and `limit` / `offset` echoes (same shape as
  `GET /products`).

The FE will paginate the `/orders` listing once that's available.

### 3. `POST /products/search` — robustness of `free_text` matching

Separate to the above, the AI search regularly returns `total: 0` for queries
like *"Mixed grade B streetwear, at least 100 pieces"* because the model
extracts `free_text: "mixed streetwear"` and the backend's exact-substring
match against `name` finds nothing in the seed catalogue. Two requested
changes:

- **OpenAI prompt:** only populate `free_text` when the user names a specific
  product / brand / style. Generic adjectives like "mixed", "vintage",
  "graded" should be ignored or mapped to the appropriate structured field
  (e.g. `grade`).
- **SQL match:** when `free_text` is set, tokenize on whitespace, drop
  stopwords, and match `ANY` token (case-insensitive) against
  `name OR brand OR description` — not the literal phrase against `name`
  only. This makes the feature actually useful given a ~25-product seed.

## `GET /reviews` — site-wide testimonials

Reviews are now site-wide testimonials about Fleek as a whole, **not** tied
to a product (the `product_id` field has been removed). Public endpoint, no
auth. Returns `{ reviews: [...], summary: { count, average_rating } }` —
full shape in `backend/API_CONTRACT.md`. Suggested usage: render on the
homepage as a "what buyers say" section.
