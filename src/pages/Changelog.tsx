const changelogEntries = [
  {
    version: '0.6.3',
    date: '2024-04-10',
    items: [
      'Added resizable navbar as global navigation.',
      'Introduced Docs and Changelog routes.',
      'Improved dark theme defaults.'
    ]
  },
  {
    version: '0.6.2',
    date: '2024-03-01',
    items: ['Stability improvements and minor UI refinements.']
  }
]

function Changelog() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Changelog
        </p>
        <h1 className="text-3xl font-semibold text-foreground">Release Notes</h1>
        <p className="text-base text-muted-foreground">
          Track updates and improvements across releases.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {changelogEntries.map((entry) => (
          <article
            key={entry.version}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold text-foreground">
                v{entry.version}
              </h2>
              <span className="text-sm text-muted-foreground">{entry.date}</span>
            </div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Changelog
