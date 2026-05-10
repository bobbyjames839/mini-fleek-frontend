export function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-3xl place-content-center gap-3 px-4 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-amber-700">Route created</p>
      <h1 className="text-4xl font-black text-fleek-text">{title}</h1>
      <p className="text-fleek-muted">
        This page is intentionally a placeholder for now. Menu buttons on Home are non-navigating.
      </p>
    </main>
  )
}
