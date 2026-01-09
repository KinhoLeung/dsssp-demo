function Docs() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Documentation
        </p>
        <h1 className="text-3xl font-semibold text-foreground">DSSSP Docs</h1>
        <p className="text-base text-muted-foreground">
          Local docs placeholder. Add real content or link sections here.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Getting Started</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is ready for docs content. Drop in guides, API references,
          or embed your documentation components.
        </p>
      </div>
    </section>
  )
}

export default Docs
