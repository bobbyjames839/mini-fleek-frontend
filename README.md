# Mini Fleek — Frontend

The buyer-facing React app for Mini Fleek, a wholesale marketplace where shops
source graded vintage and secondhand inventory in bulk from verified vendors.

This is the frontend half of the home task. It pairs with the Node.js backend
in [`../backend`](../backend) — the two are deployed independently and talk
over HTTP. The contract lives in [`API_CONTRACT.md`](./API_CONTRACT.md) (FE
notes) and [`../backend/API_CONTRACT.md`](../backend/API_CONTRACT.md) (the
authoritative source).

## Stack

- **React 19** with **Vite** (TypeScript, HMR).
- **React Router v7** for routing.
- **Redux Toolkit** + **redux-persist** for global state (auth + cached
  catalogue). Per-feature state stays local.
- **Tailwind CSS v4** for styling. Design tokens (palette, radii, shadows) are
  defined in `src/index.css` under `@theme` so the rest of the app references
  semantic names like `bg-fleek-primary` / `text-fleek-text`.
- **Supabase** auth via the backend's `/auth/*` endpoints. The FE only ever
  holds an access token + email + expiry; password handling is server-side.

## Getting started

```bash
# 1. Install
npm install

# 2. Point at a running backend (defaults to http://localhost:4000)
cp .env.example .env
# edit VITE_API_BASE_URL if your backend runs elsewhere

# 3. Run the dev server
npm run dev          # http://localhost:5173

# Other useful scripts
npm run build        # type-check + production build into ./dist
npm run preview      # preview the production build
npm run lint         # eslint
```

You'll need the backend running first — every page beyond the homepage hero
fetches real data from it. See `../backend/README.md` for how to start it.

## Project layout

```
src/
├── App.tsx                       # routes + ScrollToTop + global mounts
├── main.tsx                      # entry, Redux provider, router
├── index.css                     # design tokens, animations, base styles
│
├── components/
│   ├── SiteHeader.tsx            # logo, MainMenu, cart, account/auth
│   ├── SiteFooter.tsx
│   ├── MainMenu.tsx              # hover-driven Categories / Vendors menus
│   ├── CartButton.tsx            # cart icon + badge, listens for cart events
│   ├── ProductCard.tsx           # single product tile (used everywhere)
│   ├── AiSearchBar.tsx           # floating bottom NL search bar
│   └── Reveal.tsx                # IntersectionObserver fade-in wrapper
│
├── pages/
│   ├── HomePage.tsx              # hero, categories, featured vendor, etc
│   ├── ProductListPage.tsx       # /products grid + sidebar facets
│   ├── ProductDetailPage.tsx     # /product/:id
│   ├── CartPage.tsx
│   ├── CheckoutPage.tsx
│   ├── OrderDetailPage.tsx       # /orders/:id + place-order celebration
│   ├── OrdersPage.tsx
│   └── AuthPage.tsx              # /login + /signup
│
├── lib/
│   ├── api/
│   │   ├── client.ts             # apiFetch wrapper (auth + 401 handling)
│   │   ├── products.ts           # GET /products, GET /products/:id (cached)
│   │   ├── categories.ts
│   │   ├── vendors.ts
│   │   ├── cart.ts               # GET /cart + mutations + guest cart
│   │   ├── orders.ts             # GET /orders, GET /orders/:id (cached)
│   │   ├── reviews.ts            # GET /reviews (homepage testimonials)
│   │   └── aiSearch.ts           # POST /products/search (NL search)
│   ├── money.ts                  # GBP formatter (pence → £)
│   └── useReveal.ts              # shared IntersectionObserver hook
│
└── store/
    ├── index.ts                  # Redux store + redux-persist setup
    ├── authSlice.ts              # accessToken / email / expiresAt
    ├── catalogSlice.ts           # one-shot load of products + cats + vendors
    └── hooks.ts                  # typed useAppSelector / useAppDispatch
```

## Architecture decisions worth flagging

### One-shot catalogue load, then everything is client-side

`App` boots, dispatches `loadCatalog`, which fires `GET /products?limit=60`,
`GET /categories`, and `GET /vendors` in parallel. All filtering, sorting,
search-by-name, view-mode grouping (grid / by-vendor / by-category), home-page
"top categories per vendor", and the partner-brands marquee derive from this
single payload. The marketplace product list page does **not** re-hit the
backend on filter/sort/search changes.

This keeps the demo snappy and means there's exactly one source of truth for
catalogue data. It assumes the seed catalogue fits in 60 items; if the catalog
grows past that, swap to paginated fetches and revisit the in-page filtering.

### Per-id cache + in-flight dedup for product / order details

`getProduct(id)` and `getOrder(id)` use a small per-id `Map` cache and a
shared in-flight promise. Three benefits:
1. Returning to a previously-viewed product or order is instant.
2. React 18 StrictMode's effect double-invoke doesn't cause the first request
   to be aborted by its own cleanup.
3. Two components mounting at once (e.g. detail page + a related-products
   strip) share a single network request.

### User-scoped caches reset on any token change

`cart.ts` and `orders.ts` subscribe to the Redux store and clear their caches
on **any** access-token transition — logout, login, account-switch in the same
tab, or silent token rotation. Without this, switching account A → B in one
tab would render A's cart until the user manually refreshed. Pages that load
user-scoped data (`CartPage`, `CheckoutPage`, `OrdersPage`, `OrderDetailPage`)
key their `useEffect` on the token value (not the boolean `isAuthed`) so they
re-fetch on identity changes too.

### Guest cart → server cart merge on login

If the user adds items while logged out, they go into a `localStorage` guest
cart (`fleek_guest_cart`). On a successful login, every guest line is POSTed
to `/cart/items` in parallel (`Promise.allSettled`), then the local copy is
dropped and `getCart({ force: true })` rebroadcasts so the badge updates.

### Natural-language search

The floating bottom search bar (`components/AiSearchBar.tsx`) calls
`POST /products/search`. The backend asks OpenAI to translate the query into a
structured filter (category, vendor country list, grade, price-per-piece cap,
etc.), validates each field against the live catalogue, runs a SQL query, and
returns both the **parsed filter** and the matching products in one response.

The bar shows the user what the model understood as a chip strip
("Understood as: Y2K Streetwear · ≤ £8/piece · Grade A") so they can sanity-
check the parse, plus the matching products in a scrollable grid. While the
request is in flight there's a multi-stage loader: progress sweep, orbiting
sparkles around a pulsing avatar, a four-step ladder ("Reading your request
→ Parsing filters → Searching the catalogue → Ranking results"), and skeleton
chips/cards shaped exactly like the real result so the layout doesn't jolt
when the data lands.

### Design system

Tokens are CSS variables defined in `src/index.css` under `@theme`. The
palette is amber-warm (Fleek's brand) with semantic names:

| Token                       | Use                              |
| --------------------------- | -------------------------------- |
| `--color-fleek-bg`          | Page background                  |
| `--color-fleek-surface`     | Cards / sheets                   |
| `--color-fleek-text`        | Primary copy                     |
| `--color-fleek-muted`       | Secondary copy                   |
| `--color-fleek-primary`     | Buttons, accents (amber)         |
| `--color-fleek-primary-dark`| Hover state for primary          |
| `--color-fleek-border`      | Hairlines, card borders          |

Reusable components: `ProductCard`, the chip / pill button pattern, the
`Reveal` fade-in wrapper, the floating bar, the toast (used by add-to-cart
feedback). All animations live in `index.css` keyframes (`fleek-fade-up`,
`fleek-ai-shimmer`, `fleek-celebrate-in`, etc.) and respect
`prefers-reduced-motion`.

## Data — nothing is hardcoded

Every product, vendor, category, review, cart line, and order on screen comes
from the backend. The only static content is marketing copy (sourcing-step
tiles), the hero banner image, country-code → name maps, sort-option labels,
and the AI-search example prompts. If a reviewer adds a new product to the DB
it appears in the homepage stats, the brand marquee, the featured vendor card,
the category grid, the listing page, the AI search, etc. without any code
change.

## Routing + scroll behaviour

- `/` — Home
- `/products` — Marketplace listing with sidebar filters and view modes
- `/product/:id` — Product detail (gallery, vendor card, related products)
- `/cart` — Cart with quantity / remove
- `/checkout` — Address form + place order
- `/orders` — Order history (auth required)
- `/orders/:id` — Order detail (auth required); shows a celebratory modal
  when arrived at via a fresh checkout
- `/login` + `/signup` — Auth

A `<ScrollToTop />` mounted in `App` resets the viewport to the top on every
pathname change via `useLayoutEffect` so navigation never lands the user mid-
page.

## End-to-end funnel test

1. Land on `/` → see live categories + featured products from the seed.
2. Click "Sign up" → enter email + password → redirect back to `/`.
3. Click a category → land on `/products?category=…` with the chip applied.
4. Click a card → `/product/:id` with full detail.
5. Click "Add to cart" → toast pops, header badge increments.
6. Open `/cart` → adjust quantity, remove an item, see the subtotal recompute.
7. Click "Checkout" → fill the address → "Place order".
8. Land on `/orders/:id` with a celebration modal and a permanent order page.
9. Visit `/orders/:id` later (still signed in) → same page, no modal.

## Deployment

Production target is **Vercel** (zero-config: `npm run build` → `dist/`).
`VITE_API_BASE_URL` is set as a Vercel env var pointing at the deployed
backend. No SSR — the app is a SPA and the backend handles auth tokens via
JWT, so cookies / origin hops are not part of the loop.

## Useful files

- [`API_CONTRACT.md`](./API_CONTRACT.md) — frontend-side notes about how this
  app uses the backend, plus the open asks for the backend agent (efficiency,
  pagination, AI-search robustness).
- [`CLAUDE.md`](./CLAUDE.md) — agent brief + scope.
