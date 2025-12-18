import clsx from 'clsx'

import PauseIcon from '../../assets/pause.svg?react'
import PlayIcon from '../../assets/play.svg?react'
import StopIcon from '../../assets/stop.svg?react'

export const PlaybackButtons = ({
  playing,
  onStop,
  onToggle
}: {
  playing: boolean
  onStop: () => void
  onToggle: () => void
  }) => {
  const buttonClasses = clsx(
    'm-[-1px] rounded-sm border w-[34px] h-[34px] px-2 rounded-sm font-mono',
    'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900',
    'focus-visible:z-10 focus:outline-none focus-visible:border-sky-500 active:border-zinc-400 active:z-10',
    'dark:bg-black dark:text-zinc-500 dark:border-zinc-800 dark:hover:bg-zinc-950 dark:hover:text-zinc-300 dark:active:border-zinc-500'
  )

  return (
    <div className="flex flex-row border rounded-sm border-zinc-200 relative dark:border-zinc-800">
      <button
        className={clsx(buttonClasses, !playing && 'text-sm ')}
        aria-label="Toggle playback"
        onClick={onToggle}
      >
        {playing ? (
          <PauseIcon className="w-4 h-4" />
        ) : (
          <PlayIcon className="w-4 h-4" />
        )}
      </button>
      <button
        onClick={onStop}
        className={buttonClasses}
        aria-label="Stop"
      >
        <StopIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
