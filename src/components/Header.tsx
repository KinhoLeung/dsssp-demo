import clsx from 'clsx'
import { type GraphFilter } from 'dsssp'
import { useState } from 'react'
import tailwindColors from 'tailwindcss/colors'

import PowerIcon from '../assets/power.svg?react'

import Presets, { buttonClasses } from './Presets'

const Header = ({
  altered = false,
  powered,
  defaultPowered = true,
  presetIndex,
  onPresetChange,
  onPowerChange
}: {
  altered?: boolean
  powered?: boolean
  defaultPowered?: boolean
  presetIndex?: number
  onPresetChange: (
    newFilters: GraphFilter[],
    newIndex: number,
    prevIndex: number
  ) => void
  onPowerChange: (powered: boolean) => void
}) => {
  const [uncontrolledPowered, setUncontrolledPowered] =
    useState(defaultPowered)
  const isControlled = powered !== undefined
  const currentPowered = isControlled ? powered : uncontrolledPowered

  const togglePower = () => {
    const nextPowered = !currentPowered
    if (!isControlled) {
      setUncontrolledPowered(nextPowered)
    }
    onPowerChange(nextPowered)
  }

  const glowColor = currentPowered
    ? tailwindColors.green[500]
    : tailwindColors.red[950]

  return (
    <div className="flex flex-row w-full gap-2 py-2 px-3 bg-white text-zinc-600 border border-zinc-200 rounded-sm shadow-sm items-center justify-between dark:bg-black dark:text-zinc-500 dark:border-zinc-800">
      <div className="flex flex-row gap-3">
        <button
          className={clsx(buttonClasses, 'px-3 m-[0] h-[34px] ', {
            'text-green-600 hover:text-green-400 ': currentPowered,
            'text-red-700 hover:text-red-500 ': !currentPowered
          })}
          style={{
            background: `radial-gradient(circle, ${glowColor}20 0%, ${glowColor}18 30%, transparent 70%)`
          }}
          onClick={togglePower}
          aria-label="Power"
        >
          <PowerIcon className="w-3.5 h-3.5" />
        </button>

        <Presets
          powered={currentPowered}
          altered={altered}
          onPresetChange={onPresetChange}
          presetIndex={presetIndex}
        />
      </div>
    </div>
  )
}

export default Header
