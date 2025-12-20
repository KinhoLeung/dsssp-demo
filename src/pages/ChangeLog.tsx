import { ScrollTimeline, type TimelineEvent } from '@/components/lightswind/scroll-timeline'

const ChangeLog = () => {
  const events: TimelineEvent[] = [
    {
      year: '2024-09',
      title: 'v1.2 Release',
      subtitle: 'Stability Update',
      description:
        'Improved USB connection handling and reduced reconnect time across devices.'
    },
    {
      year: '2024-07',
      title: 'v1.1 Update',
      subtitle: 'UI Polish',
      description:
        'Refined navigation animations and added clearer status feedback for controls.'
    },
    {
      year: '2024-05',
      title: 'v1.0 Launch',
      subtitle: 'Initial Public Release',
      description:
        'Core dashboard, device monitoring, and demo mode are available in the first release.'
    }
  ]

  return (
    <ScrollTimeline
      title="Change Log"
      subtitle="Latest updates and product milestones"
      events={events}
      cardAlignment="alternating"
      progressIndicator={true}
      cardEffect="glow"
      className="bg-background"
      darkMode={true}
    />
  )
}

export default ChangeLog
