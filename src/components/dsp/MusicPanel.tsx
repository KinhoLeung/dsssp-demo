import { DspPanel, type DspPanelProps } from './DspPanel'
import {
  getEnumNumberValue,
  hasAny,
  hasEnum,
  hasNumber,
  INPUT_SELECT_OPTIONS,
  type PanelState,
  type SelectOption,
} from './dspUtils'
import { NumberControl } from './NumberControl'
import { ParameterCard } from './ParameterCard'
import { ToggleGroupControl } from './ToggleGroupControl'

import type { buildParameterRanges } from '@/configs/parameterRanges'
import { webhmi } from '@/device/proto/generated/webhmi'

type MusicRanges = ReturnType<typeof buildParameterRanges>['music']
type EqPanelBindings = Pick<
  DspPanelProps,
  | 'activeIndex'
  | 'dragging'
  | 'handleFilterChange'
  | 'handlePointDoubleClick'
  | 'handleMouseEnter'
  | 'handleMouseLeave'
  | 'setDragging'
>

export type MusicPanelProps = EqPanelBindings & {
  musicDb: webhmi.IMusicDb
  musicRanges: MusicRanges
  panelState: PanelState
  panelPower: Pick<DspPanelProps, 'powered' | 'bypass'>
  disabled: boolean
  queueMusic: (patch: webhmi.ISetMusicRequest) => void
  resetEq: (target: webhmi.EqTarget) => void | Promise<unknown>
  queueEqBypass: (target: webhmi.EqTarget, bypass: boolean) => void
}

const getMusicInputSelectValue = (musicDb: webhmi.IMusicDb) => {
  const val = getEnumNumberValue(musicDb.inputSelect, webhmi.InputSelect)
  return !Number.isNaN(val) ? String(val) : undefined
}

const getMusicInputSelectOptions = (musicDb: webhmi.IMusicDb): SelectOption[] => {
  if (musicDb.inputSelectList && musicDb.inputSelectList.length > 0) {
    return musicDb.inputSelectList.map((val) => {
      const numVal = getEnumNumberValue(val, webhmi.InputSelect)
      const name = webhmi.InputSelect[numVal] || String(val)
      return {
        value: String(numVal),
        label: name,
      }
    })
  }

  return INPUT_SELECT_OPTIONS
}

export function MusicPanel({
  musicDb,
  musicRanges,
  panelState,
  panelPower,
  disabled,
  activeIndex,
  dragging,
  handleFilterChange,
  handlePointDoubleClick,
  handleMouseEnter,
  handleMouseLeave,
  setDragging,
  queueMusic,
  resetEq,
  queueEqBypass,
}: MusicPanelProps) {
  const showParamsCard =
    hasAny(
      musicDb.inputGain,
      musicDb.musicPitch,
      musicDb.btGain,
      musicDb.udiskGain,
      musicDb.bass,
      musicDb.mid,
      musicDb.midFreq,
      musicDb.treble,
    ) || hasEnum(musicDb.inputSelect, webhmi.InputSelect)
  const showNoiseCard =
    !!musicDb.noise && hasAny(musicDb.noise.gate, musicDb.noise.frameTime, musicDb.noise.atkTime, musicDb.noise.relTime)
  const inputSelectValue = getMusicInputSelectValue(musicDb)
  const inputSelectOptions = getMusicInputSelectOptions(musicDb)

  return (
    <div className="flex flex-col gap-4">
      <DspPanel
        {...panelPower}
        eqRange={musicRanges.eq}
        filters={panelState.filters}
        allowedTypesByUiIndex={panelState.allowedTypesByUiIndex}
        pointIndexByUiIndex={panelState.pointIndexByUiIndex}
        activeIndex={activeIndex}
        dragging={dragging}
        handleFilterChange={handleFilterChange}
        handlePointDoubleClick={handlePointDoubleClick}
        handleMouseEnter={handleMouseEnter}
        handleMouseLeave={handleMouseLeave}
        setDragging={setDragging}
        onReset={() => void resetEq(webhmi.EqTarget.MUSIC)}
        onBypassChange={(pressed) => queueEqBypass(webhmi.EqTarget.MUSIC, pressed)}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {showParamsCard && (
          <ParameterCard className="md:col-span-2" contentClassName="sm:grid-cols-2 md:grid-cols-4">
            {hasNumber(musicDb.inputGain) && (
              <NumberControl
                label="Input Gain"
                value={musicDb.inputGain ?? undefined}
                {...musicRanges.inputGain}
                disabled={disabled}
                onChange={(value) => queueMusic({ inputGain: Math.round(value) })}
              />
            )}
            {hasNumber(musicDb.musicPitch) && (
              <NumberControl
                label="Music Pitch"
                value={musicDb.musicPitch ?? undefined}
                {...musicRanges.musicPitch}
                disabled={disabled}
                onChange={(value) => queueMusic({ musicPitch: value })}
              />
            )}
            {hasNumber(musicDb.btGain) && (
              <NumberControl
                label="BT Gain"
                value={musicDb.btGain ?? undefined}
                {...musicRanges.btGain}
                disabled={disabled}
                onChange={(value) => queueMusic({ btGain: Math.round(value) })}
              />
            )}
            {hasNumber(musicDb.udiskGain) && (
              <NumberControl
                label="UDisk Gain"
                value={musicDb.udiskGain ?? undefined}
                {...musicRanges.udiskGain}
                disabled={disabled}
                onChange={(value) => queueMusic({ udiskGain: Math.round(value) })}
              />
            )}
            {hasEnum(musicDb.inputSelect, webhmi.InputSelect) && (
              <div className="sm:col-span-2 md:col-span-4">
                <ToggleGroupControl
                  label="Input Select"
                  value={inputSelectValue}
                  options={inputSelectOptions}
                  disabled={disabled}
                  onChange={(value) => {
                    const parsed = Number(value)
                    if (!Number.isNaN(parsed)) queueMusic({ inputSelect: parsed as webhmi.InputSelect })
                  }}
                />
              </div>
            )}
            {hasNumber(musicDb.bass) && (
              <NumberControl
                label="Bass"
                value={musicDb.bass ?? undefined}
                {...musicRanges.bass}
                disabled={disabled}
                onChange={(value) => queueMusic({ bass: value })}
              />
            )}
            {hasNumber(musicDb.mid) && (
              <NumberControl
                label="Mid"
                value={musicDb.mid ?? undefined}
                {...musicRanges.mid}
                disabled={disabled}
                onChange={(value) => queueMusic({ mid: value })}
              />
            )}
            {hasNumber(musicDb.midFreq) && (
              <NumberControl
                label="Mid Freq (Hz)"
                value={musicDb.midFreq ?? undefined}
                {...musicRanges.midFreq}
                disabled={disabled}
                onChange={(value) => queueMusic({ midFreq: Math.round(value) })}
              />
            )}
            {hasNumber(musicDb.treble) && (
              <NumberControl
                label="Treble"
                value={musicDb.treble ?? undefined}
                {...musicRanges.treble}
                disabled={disabled}
                onChange={(value) => queueMusic({ treble: value })}
              />
            )}
          </ParameterCard>
        )}
        {showNoiseCard && (
          <ParameterCard title="Noise Gate" contentClassName="sm:grid-cols-2">
            {hasNumber(musicDb.noise?.gate) && (
              <NumberControl
                label="Gate"
                value={musicDb.noise?.gate ?? undefined}
                {...musicRanges.noise.gate}
                disabled={disabled}
                onChange={(value) => queueMusic({ noise: { gate: value } })}
              />
            )}
            {hasNumber(musicDb.noise?.frameTime) && (
              <NumberControl
                label="Frame Time"
                value={musicDb.noise?.frameTime ?? undefined}
                {...musicRanges.noise.frameTime}
                disabled={disabled}
                onChange={(value) => queueMusic({ noise: { frameTime: Math.round(value) } })}
              />
            )}
            {hasNumber(musicDb.noise?.atkTime) && (
              <NumberControl
                label="Attack Time"
                value={musicDb.noise?.atkTime ?? undefined}
                {...musicRanges.noise.atkTime}
                disabled={disabled}
                onChange={(value) => queueMusic({ noise: { atkTime: Math.round(value) } })}
              />
            )}
            {hasNumber(musicDb.noise?.relTime) && (
              <NumberControl
                label="Release Time"
                value={musicDb.noise?.relTime ?? undefined}
                {...musicRanges.noise.relTime}
                disabled={disabled}
                onChange={(value) => queueMusic({ noise: { relTime: Math.round(value) } })}
              />
            )}
          </ParameterCard>
        )}
      </div>
    </div>
  )
}
