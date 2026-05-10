import { Link } from 'react-router-dom'
import type { ProductSummary } from '../lib/api/products'
import { formatGBP } from '../lib/money'

interface ProductCardProps {
  product: ProductSummary
}

export function ProductCard({ product }: ProductCardProps) {
  const isSoldOut = product.status === 'sold_out'

  return (
    <Link
      to={`/product/${product.id}`}
      className={`group flex flex-col overflow-hidden rounded-3xl border border-fleek-border bg-white shadow-sm shadow-amber-900/5 transition-colors duration-150 ease-out ${
        isSoldOut ? 'opacity-70' : 'hover:border-fleek-primary/50'
      }`}
    >
      <div className="relative overflow-hidden">
        {product.primary_photo ? (
          <img
            src={product.primary_photo}
            alt={product.name}
            loading="lazy"
            className="h-56 w-full object-cover"
          />
        ) : (
          <div className="flex h-56 w-full items-center justify-center bg-fleek-bg text-xs uppercase tracking-[0.14em] text-fleek-muted">
            No photo
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {product.discount_pct ? (
            <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white shadow-md shadow-emerald-900/20">
              -{product.discount_pct}%
            </span>
          ) : null}
          {isSoldOut ? (
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
              Sold out
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-fleek-text transition-colors duration-150 group-hover:text-fleek-primary-dark">
          {product.name}
        </h3>

        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-lg font-semibold text-fleek-text">
            {formatGBP(product.total_price, { precision: 0 })}
          </span>
          {product.original_total_price ? (
            <span className="text-xs text-fleek-muted line-through">
              {formatGBP(product.original_total_price, { precision: 0 })}
            </span>
          ) : null}
          <span className="ml-auto text-xs text-fleek-muted">
            {formatGBP(product.price_per_piece)}/pc
          </span>
        </div>
      </div>
    </Link>
  )
}
