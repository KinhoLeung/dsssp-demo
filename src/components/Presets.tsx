import clsx from 'clsx'
import { type GraphFilter } from 'dsssp'
import { useState } from 'react'

import LeftArrowIcon from '../assets/left-arrow.svg?react'
import RightArrowIcon from '../assets/right-arrow.svg?react'
import SelectArrowIcon from '../assets/select-arrow.svg?react'
import presets from '../configs/presets'

export const buttonClasses =
  'px-2 py-1 m-[-1px] text-sm bg-white text-zinc-700 border border-zinc-200 rounded-sm hover:bg-zinc-50 focus-visible:z-10 focus:outline-none focus-visible:border-sky-500 active:border-zinc-400 active:z-10 dark:bg-black dark:text-zinc-500 dark:border-zinc-800 dark:hover:bg-zinc-950 dark:active:border-zinc-500'

const PresetControl = ({
  powered,
  altered,
  onPresetChange,
  presetIndex,
  defaultPresetIndex = 0
}: {
  powered: boolean
  altered: boolean
  onPresetChange: (
    newFilters: GraphFilter[],
    newIndex: number,
    prevIndex: number
  ) => void
  presetIndex?: number
  defaultPresetIndex?: number
}) => {
  const [opened, setOpened] = useState<boolean>(false)
  const [uncontrolledPresetIndex, setUncontrolledPresetIndex] = useState(
    defaultPresetIndex
  )
  const isControlled = presetIndex !== undefined
  const currentPresetIndex = isControlled
    ? presetIndex
    : uncontrolledPresetIndex

  const setPresetIndex = (nextIndex: number) => {
    if (!isControlled) {
      setUncontrolledPresetIndex(nextIndex)
    }
  }

  const handlePrevClick = () => {
    const newIndex =
      (currentPresetIndex - 1 + presets.length) % presets.length
    onPresetChange(presets[newIndex].filters, newIndex, currentPresetIndex)
    setPresetIndex(newIndex)
  }

  const handleNextClick = () => {
    const newIndex = (currentPresetIndex + 1) % presets.length
    onPresetChange(presets[newIndex].filters, newIndex, currentPresetIndex)
    setPresetIndex(newIndex)
  }

  const handleResetClick = () => {
    onPresetChange(
      presets[currentPresetIndex].filters,
      currentPresetIndex,
      currentPresetIndex
    )
  }

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOpened(false)
    const newIndex = presets.findIndex(
      (preset) => preset.name === e.target.value
    )
    onPresetChange(presets[newIndex].filters, newIndex, currentPresetIndex)
    setPresetIndex(newIndex)
  }

  return (
    <div
      className={clsx('flex flex-row gap-3 transition-opacity duration-150', {
        'opacity-100 pointer-events-auto': powered,
        'opacity-50 pointer-events-none': !powered
      })}
    >
      <div className="flex flex-row border rounded-sm border-zinc-200 relative dark:border-zinc-800">
        <div className="w-[140px] py-1 px-3 text-center relative">
          <select
            onBlur={() => setOpened(false)}
            onFocus={() => setOpened(true)}
            onMouseDown={() => setOpened(true)}
            onChange={handlePresetChange}
            value={presets[currentPresetIndex].name}
            className="bg-transparent text-transparent appearance-none text-align-center w-[92px] h-full px-1 top-0 left-6 cursor-pointer absolute focus:outline-none focus:ring-0"
          >
            {presets.map((preset) => (
              <option
                key={preset.name}
                value={preset.name}
                className="bg-white text-zinc-900 text-sm text-align-center dark:bg-zinc-950 dark:text-white"
              >
                &nbsp;{preset.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2 flex-row justify-center items-center">
            {presets[currentPresetIndex].name}
            <div
              className={clsx('pt-0.5 pointer-events-none z-10', {
                'text-sky-500': opened
              })}
            >
              <SelectArrowIcon className="w-3 h-3" />
            </div>
          </div>
        </div>

        <button
          className={clsx(buttonClasses, 'hover:text-zinc-900 dark:hover:text-zinc-200')}
          onClick={handlePrevClick}
          aria-label="Previous preset"
        >
          <LeftArrowIcon className="w-4 h-4" />
        </button>

        <button
          className={clsx(buttonClasses, 'hover:text-zinc-900 dark:hover:text-zinc-200')}
          onClick={handleNextClick}
          aria-label="Next preset"
        >
          <RightArrowIcon className="w-4 h-4" />
        </button>
      </div>

      <button
        className={clsx(
          buttonClasses,
          'px-3 text-xs uppercase transition-opacity duration-150',
          {
            'opacity-0 pointer-events-none': !altered,
            'opacity-100': altered,
            'pointer-events-auto': altered && powered
          }
        )}
        onClick={handleResetClick}
        aria-label="reset"
      >
        Reset
      </button>
    </div>
  )
}

export default PresetControl
