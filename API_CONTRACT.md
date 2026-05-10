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

## `GET /reviews` — site-wide testimonials

Reviews are now site-wide testimonials about Fleek as a whole, **not** tied
to a product (the `product_id` field has been removed). Public endpoint, no
auth. Returns `{ reviews: [...], summary: { count, average_rating } }` —
full shape in `backend/API_CONTRACT.md`. Suggested usage: render on the
homepage as a "what buyers say" section.
