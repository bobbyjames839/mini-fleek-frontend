import { Link } from 'react-router-dom'
import { useAppSelector } from '../store/hooks'

interface FooterLink {
  label: string
  to: string
  authedOnly?: boolean
  guestOnly?: boolean
}

const footerColumns: { heading: string; links: FooterLink[] }[] = [
  {
    heading: 'Marketplace',
    links: [
      { label: 'Browse bundles', to: '/products' },
      { label: 'Shop by category', to: '/products' },
      { label: 'Shop by vendor', to: '/products?view=by_vendor' },
      { label: 'New this week', to: '/products?sort=newest' },
    ],
  },
  {
    heading: 'Buyers',
    links: [
      { label: 'How sourcing works', to: '/' },
      { label: 'Create an account', to: '/signup', guestOnly: true },
      { label: 'Log in', to: '/login', guestOnly: true },
      { label: 'My cart', to: '/cart', authedOnly: true },
      { label: 'My orders', to: '/orders', authedOnly: true },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About MiniFleek', to: '/' },
      { label: 'Home', to: '/' },
    ],
  },
]

export function SiteFooter() {
  const isAuthed = useAppSelector((state) => Boolean(state.auth.accessToken))
  return (
    <footer className="relative z-10 border-t border-fleek-border/70 bg-white/70 backdrop-blur-md">
      <div className="grid gap-10 px-4 py-12 md:grid-cols-[1.4fr_2fr] md:px-8 md:py-14 lg:px-10">
        <div className="space-y-3">
          <p className="text-lg font-semibold tracking-[0.16em] text-fleek-text">MINI//FLEEK</p>
          <p className="max-w-sm text-sm text-fleek-muted">
            A v0 demo of the Fleek buyer experience — designed and built end-to-end for the home task.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {footerColumns.map((column) => (
            <div key={column.heading}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-text">
                {column.heading}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-fleek-muted">
                {column.links
                  .filter((link) => {
                    if (link.authedOnly && !isAuthed) return false
                    if (link.guestOnly && isAuthed) return false
                    return true
                  })
                  .map((link) => (
                    <li key={link.label}>
                      <Link to={link.to} className="transition hover:text-fleek-primary">
                        {link.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-fleek-border/70 px-4 py-4 text-xs text-fleek-muted md:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} MiniFleek. Demo build for evaluation.</span>
        </div>
      </div>
    </footer>
  )
}
