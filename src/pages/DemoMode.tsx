import {
  FrequencyResponseGraph,
  CompositeCurve,
  FilterCurve,
  FilterGradient,
  type FilterChangeEvent,
  FilterPoint,
  PointerTracker,
  type GraphFilter,
  FrequencyResponseCurve
} from 'dsssp'
import { useLayoutEffect, useRef, useState } from 'react'
import tailwindColors from 'tailwindcss/colors'

import styles from '../App.module.css'
import { FilterCard } from '../components'
import { customPreset } from '../configs/presets'
import scale from '../configs/scale'
import { graphThemeDark, graphThemeLight } from '../configs/theme'
import MainOutputIcon from '@/assets/AntDesignSoundOutlined.svg?react'
import SubOutputIcon from '@/assets/F7Hifispeaker.svg?react'
import MusicIcon from '@/assets/IconamoonMusic2Light.svg?react'
import SurroundIcon from '@/assets/FluentPersonSoundSpatial48Regular.svg?react'
import MicIcon from '@/assets/PepiconsPencilMicrophoneHandheld.svg?react'
import EchoIcon from '@/assets/GameIconsSonicScreech.svg?react'
import ReverbIcon from '@/assets/MdiHomeSoundInOutline.svg?react'
import CenterIcon from '@/assets/StreamlineSpeaker1.svg?react'
import { buttonVariants } from '@/components/ui/button'
import { Dock, DockIcon, DockPanel, DockTabs } from '@/components/ui/dock'
import { GlowingEffect } from '@/components/ui/glowing-effect'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { ABSlider as ABSliderAlt } from '@/components/ABSlider'
import DraggableVolumeKnob from '@/components/javascript-draggable-volume-knob/DraggableVolumeKnob'

type EqState = {
  powered: boolean
  altered: boolean
  filters: GraphFilter[]
  dragging: boolean
  activeIndex: number
  presetIndex: number
}

const DOCK_DATA = {
  navbar: [
    { value: 'music', icon: MusicIcon, label: 'Music' },
    { value: 'mic', icon: MicIcon, label: 'Mic' },
    { value: 'reverb', icon: ReverbIcon, label: 'Reverb' },
    { value: 'echo', icon: EchoIcon, label: 'Echo' },
  ],
  contact: {
    social: {
      MainOutput: {
        value: 'main-output',
        name: 'Main Output',
        icon: MainOutputIcon,
      },
      Center: {
        value: 'center',
        name: 'Center',
        icon: CenterIcon,
      },
      SubOutput: {
        value: 'sub-output',
        name: 'Sub Output',
        icon: SubOutputIcon,
      },
      Surround: {
        value: 'surround',
        name: 'Surround',
        icon: SurroundIcon,
      },
    },
  },
}

const DOCK_PANELS = [
  ...DOCK_DATA.navbar.map((item) => ({
    value: item.value,
    label: item.label,
  })),
  ...Object.values(DOCK_DATA.contact.social).map((item) => ({
    value: item.value,
    label: item.name,
  })),
]

const cloneFilters = (filters: GraphFilter[]) =>
  filters.map((filter) => ({ ...filter }))

const createEqState = (): EqState => ({
  powered: true,
  altered: false,
  filters: cloneFilters(customPreset),
  dragging: false,
  activeIndex: -1,
  presetIndex: 0,
})

const DemoMode = () => {
  const { theme } = useTheme()
  const [dockValue, setDockValue] = useState(
    () => DOCK_DATA.navbar[0]?.value ?? 'music'
  )
  const [sliderValueAlt, setSliderValueAlt] = useState(35)
  const [eqStates, setEqStates] = useState<Record<string, EqState>>(() => {
    const initial: Record<string, EqState> = {}
    DOCK_PANELS.forEach((panel) => {
      initial[panel.value] = createEqState()
    })
    return initial
  })

  const graphContainerRef = useRef<HTMLDivElement | null>(null)
  const [graphWidth, setGraphWidth] = useState(0)
  const currentEq = eqStates[dockValue] ?? createEqState()
  const graphTheme = theme === 'dark' ? graphThemeDark : graphThemeLight
  const mutedCurveColor =
    theme === 'dark' ? tailwindColors.slate[500] : tailwindColors.slate[400]

  const updateEqState = (
    value: string,
    updater: (prev: EqState) => EqState
  ) => {
    setEqStates((prev) => {
      const existing = prev[value] ?? createEqState()
      const nextState = updater(existing)
      if (nextState === existing) {
        return prev
      }
      return {
        ...prev,
        [value]: nextState,
      }
    })
  }

  const handleFilterChange = (filterEvent: FilterChangeEvent) => {
    const { index, ended, ...filter } = filterEvent

    updateEqState(dockValue, (prev) => {
      const newFilters = [...prev.filters]
      newFilters[index] = { ...newFilters[index], ...filter }
      return {
        ...prev,
        filters: newFilters,
        altered: ended ? true : prev.altered,
      }
    })
  }

  const handleMouseLeave = () => {
    updateEqState(dockValue, (prev) =>
      prev.dragging ? prev : { ...prev, activeIndex: -1 }
    )
  }

  const handleMouseEnter = ({ index }: { index: number }) => {
    updateEqState(dockValue, (prev) =>
      prev.dragging ? prev : { ...prev, activeIndex: index }
    )
  }

  const handlePresetChange = (
    preset: GraphFilter[],
    newIndex: number,
    _prevIndex: number
  ) => {
    updateEqState(dockValue, (prev) => ({
      ...prev,
      altered: false,
      filters: cloneFilters(preset),
      presetIndex: newIndex,
    }))
  }

  const handlePowerChange = (nextPowered: boolean) => {
    updateEqState(dockValue, (prev) => ({
      ...prev,
      powered: nextPowered,
    }))
  }

  const handleDragChange = (isDragging: boolean) => {
    updateEqState(dockValue, (prev) => ({
      ...prev,
      dragging: isDragging,
    }))
  }

  useLayoutEffect(() => {
    const element = graphContainerRef.current
    if (!element) return

    const updateWidth = () => {
      const nextWidth = Math.floor(element.getBoundingClientRect().width)
      setGraphWidth((prevWidth) =>
        prevWidth === nextWidth ? prevWidth : nextWidth
      )
    }

    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [dockValue])

  return (
    <DockTabs value={dockValue} onValueChange={setDockValue}>
      <div className="text-sans min-h-screen flex flex-col items-center pb-24">
        <div className="w-full max-w-[880px] px-3 pb-6 pt-3 sm:px-6">
          {DOCK_PANELS.map((panel) => (
            <DockPanel key={panel.value} value={panel.value} className="w-full">
              <div className="relative rounded-2xl border p-2 md:rounded-3xl md:p-3">
                <GlowingEffect
                  spread={40}
                  glow={true}
                  disabled={false}
                  proximity={80}
                  inactiveZone={0.02}
                />
                <div className="relative flex flex-col gap-1 overflow-hidden rounded-xl border border-black/5 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-neutral-900/60 dark:shadow-[0px_0px_27px_0px_#2D2D2D] md:p-6">
                  <div
                    ref={graphContainerRef}
                    className="relative overflow-hidden rounded-xl md:rounded-2xl"
                  >
                    {graphWidth > 0 && (
                      <FrequencyResponseGraph
                        width={graphWidth}
                        height={360}
                        theme={graphTheme}
                        scale={scale}
                      >
                        {currentEq.powered ? (
                          <>
                            {currentEq.filters.map((filter, index) => (
                              <>
                                <FilterGradient
                                  fill={true}
                                  key={index}
                                  index={index}
                                  filter={filter}
                                  id={`filter-${index}`}
                                />

                                <FilterCurve
                                  showPin
                                  key={index}
                                  index={index}
                                  filter={filter}
                                  active={currentEq.activeIndex === index}
                                  gradientId={`filter-${index}`}
                                />
                              </>
                            ))}
                            <CompositeCurve filters={currentEq.filters} />
                            {currentEq.filters.map((filter, index) => (
                              <FilterPoint
                                key={index}
                                index={index}
                                filter={filter}
                                // label={getLabel(index)}
                                active={currentEq.activeIndex === index}
                                onDrag={handleDragChange}
                                onEnter={handleMouseEnter}
                                onLeave={handleMouseLeave}
                                onChange={handleFilterChange}
                              />
                            ))}
                            {!currentEq.dragging && <PointerTracker />}
                          </>
                        ) : (
                          <FrequencyResponseCurve
                            dotted
                            magnitudes={[]}
                            color={mutedCurveColor}
                          />
                        )}
                      </FrequencyResponseGraph>
                    )}

                    <div className={styles.glareOverlay}></div>
                  </div>

                  <div className="flex gap-1 w-full pb-1">
                    {currentEq.filters.map((filter, index) => (
                      <FilterCard
                        key={index}
                        index={index}
                        filter={filter}
                        disabled={!currentEq.powered}
                        active={currentEq.activeIndex === index}
                        onLeave={handleMouseLeave}
                        onEnter={handleMouseEnter}
                        onChange={handleFilterChange}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </DockPanel>
          ))}
        </div>
        <div className="w-full max-w-[880px] px-3 pb-24 sm:px-6">
          <div className="relative rounded-2xl border p-2 md:rounded-3xl md:p-3">
            <GlowingEffect
              spread={40}
              glow={true}
              disabled={false}
              proximity={80}
              inactiveZone={0.02}
            />
            <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-xl border border-black/5 bg-white/70 p-6 text-center backdrop-blur dark:border-white/10 dark:bg-neutral-900/60 dark:shadow-[0px_0px_27px_0px_#2D2D2D]">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                ABSlider
              </span>
              <ABSliderAlt
                value={sliderValueAlt}
                onChange={setSliderValueAlt}
                ledOpacity={sliderValueAlt / 100}
                min={0}
                max={100}
                step={1}
                aria-label="AB slider alt"
              />
            </div>
          </div>
        </div>
        <div className="w-full max-w-[880px] px-3 pb-24 sm:px-6">
          <div className="relative rounded-2xl border p-2 md:rounded-3xl md:p-3">
            <GlowingEffect
              spread={40}
              glow={true}
              disabled={false}
              proximity={80}
              inactiveZone={0.02}
              variant="white"
            />
            <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-xl border border-black/5 bg-white/70 p-6 text-center backdrop-blur dark:border-white/10 dark:bg-neutral-900/60 dark:shadow-[0px_0px_27px_0px_#2D2D2D]">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Draggable Volume Knob
              </span>
              <DraggableVolumeKnob initialVolume={35} />
            </div>
          </div>
        </div>
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <Dock
            className="mt-0"
            direction="middle"
            ariaLabel="Dock tabs"
            iconMagnification={50}
          >
            {DOCK_DATA.navbar.map((item) => (
              <DockIcon
                key={item.value}
                value={item.value}
                tooltip={item.label}
                tooltipSide="top"
                aria-label={item.label}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  'size-12 rounded-full'
                )}
              >
                <item.icon className="size-4" />
              </DockIcon>
            ))}
            {Object.entries(DOCK_DATA.contact.social).map(([name, social]) => (
              <DockIcon
                key={name}
                value={social.value}
                tooltip={social.name}
                tooltipSide="top"
                aria-label={social.name}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  'size-12 rounded-full'
                )}
              >
                <social.icon className="size-4" />
              </DockIcon>
            ))}
          </Dock>
        </div>
      </div>
    </DockTabs>
  )
}

export default DemoMode
