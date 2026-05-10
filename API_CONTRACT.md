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
