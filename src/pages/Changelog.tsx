import { Timeline } from '@/components/ui/timeline'

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
  const timelineData = changelogEntries.map((entry) => ({
    title: `v${entry.version}`,
    content: (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-base font-semibold text-foreground">Release</h4>
          <span className="text-sm text-muted-foreground">{entry.date}</span>
        </div>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {entry.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    )
  }))

  return (
    <Timeline
      data={timelineData}
      title="Changelog"
      description="Release notes and updates across recent versions."
    />
  )
}

export default Changelog
