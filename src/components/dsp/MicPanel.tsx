import type { Dispatch, SetStateAction } from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { CompressorGraph } from './CompressorGraph'
import { DspPanel, type DspPanelProps } from './DspPanel'
import {
  FBX_OPTIONS,
  getEnumNumberValue,
  hasAny,
  hasBoolean,
  hasEnum,
  hasNumber,
  type PanelState,
  type SelectOption,
  uiTextKey,
} from './dspUtils'
import { NumberControl } from './NumberControl'
import { ParameterCard } from './ParameterCard'
import { ToggleControl } from './ToggleControl'
import { ToggleGroupControl } from './ToggleGroupControl'

import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { buildParameterRanges } from '@/configs/parameterRanges'
import { webhmi } from '@/device/proto/generated/webhmi'

export type MicPanelKey = 'mica' | 'micb'

type MicRanges = ReturnType<typeof buildParameterRanges>['mic']
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

export type MicPanelProps = EqPanelBindings & {
  micDb: webhmi.IMicDb
  deviceConfig: webhmi.IDeviceConfig | null
  micRanges: MicRanges
  micKey: MicPanelKey
  setMicKey: Dispatch<SetStateAction<MicPanelKey>>
  showMicSelector: boolean
  panelState: PanelState
  panelPower: Pick<DspPanelProps, 'powered' | 'bypass'>
  disabled: boolean
  queueMic: (patch: webhmi.ISetMicRequest) => void
  queueEqBypass: (target: webhmi.EqTarget, bypass: boolean) => void
  queueEqPoint: (target: webhmi.EqTarget, patch: webhmi.IEqPointPatch) => void
  resetEq: (target: webhmi.EqTarget) => void | Promise<unknown>
}

const getMicTarget = (key: MicPanelKey) => (key === 'mica' ? webhmi.EqTarget.MIC_A : webhmi.EqTarget.MIC_B)
const getOtherMicKey = (key: MicPanelKey): MicPanelKey => (key === 'mica' ? 'micb' : 'mica')
const getMicEq = (db: webhmi.IDeviceConfig | null, key: MicPanelKey) =>
  key === 'mica' ? db?.db?.mic?.micAEq?.eq : db?.db?.mic?.micBEq?.eq

const getMicFbxValue = (micDb: webhmi.IMicDb) => {
  const val = getEnumNumberValue(micDb.micFBX, webhmi.FbxMode)
  return !Number.isNaN(val) ? String(val) : undefined
}

const getMicFbxOptions = (micDb: webhmi.IMicDb): SelectOption[] => {
  if (micDb.fbxModeList && micDb.fbxModeList.length > 0) {
    return micDb.fbxModeList.map((val) => {
      const numVal = getEnumNumberValue(val, webhmi.FbxMode)
      const name = webhmi.FbxMode[numVal] || String(val)
      return {
        value: String(numVal),
        label: name,
      }
    })
  }

  return FBX_OPTIONS
}

export function MicPanel({
  micDb,
  deviceConfig,
  micRanges,
  micKey,
  setMicKey,
  showMicSelector,
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
  queueMic,
  queueEqBypass,
  queueEqPoint,
  resetEq,
}: MicPanelProps) {
  const { t } = useTranslation()
  const uiText = useCallback((text: string) => t(`uiText.${uiTextKey(text)}`, { defaultValue: text }), [t])

  const showParamsCard =
    hasAny(
      micDb.micAVolume,
      micDb.micBVolume,
      micDb.micEqJointDebugging,
      micDb.bass,
      micDb.mid,
      micDb.midFreq,
      micDb.treble,
    ) || hasEnum(micDb.micFBX, webhmi.FbxMode)
  const showNoiseCard =
    !!micDb.noise && hasAny(micDb.noise.gate, micDb.noise.frameTime, micDb.noise.atkTime, micDb.noise.relTime)
  const showCompressorCard =
    !!micDb.compressor &&
    hasAny(
      micDb.compressor.threshold,
      micDb.compressor.ratio,
      micDb.compressor.attack,
      micDb.compressor.release,
      micDb.compressor.bypass,
    )
  const micFbxValue = getMicFbxValue(micDb)
  const micFbxOptions = getMicFbxOptions(micDb)
  const jointDebugging = !!deviceConfig?.db?.mic?.micEqJointDebugging

  return (
    <div className="flex flex-col gap-4">
      <DspPanel
        {...panelPower}
        eqRange={micKey === 'mica' ? micRanges.micAEq.eq : micRanges.micBEq.eq}
        filters={panelState.filters}
        allowedTypesByUiIndex={panelState.allowedTypesByUiIndex}
        pointIndexByUiIndex={panelState.pointIndexByUiIndex}
        activeIndex={activeIndex}
        dragging={dragging}
        headerExtra={
          showMicSelector || hasBoolean(micDb.micEqJointDebugging) ? (
            <div className="flex items-center gap-4">
              {showMicSelector && (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={micKey}
                  onValueChange={(v) => v && setMicKey(v as MicPanelKey)}
                  className="gap-0"
                >
                  <ToggleGroupItem value="mica" className="rounded-r-none">
                    Mic A
                  </ToggleGroupItem>
                  <ToggleGroupItem value="micb" className="rounded-l-none border-l-0">
                    Mic B
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
              {showMicSelector && hasBoolean(micDb.micEqJointDebugging) && (
                <Toggle
                  variant="outline"
                  pressed={!!micDb.micEqJointDebugging}
                  onPressedChange={(pressed) => {
                    if (pressed) {
                      const sourceEq = getMicEq(deviceConfig, micKey)
                      const target = getMicTarget(getOtherMicKey(micKey))

                      if (sourceEq) {
                        if (typeof sourceEq.bypass === 'boolean') {
                          queueEqBypass(target, sourceEq.bypass)
                        }
                        if (Array.isArray(sourceEq.point)) {
                          for (const p of sourceEq.point) {
                            queueEqPoint(target, p)
                          }
                        }
                      }
                    }
                    queueMic({ micEqJointDebugging: pressed })
                  }}
                  disabled={disabled}
                >
                  {uiText('Mic EQ Link')}
                </Toggle>
              )}
            </div>
          ) : null
        }
        handleFilterChange={handleFilterChange}
        handlePointDoubleClick={handlePointDoubleClick}
        handleMouseEnter={handleMouseEnter}
        handleMouseLeave={handleMouseLeave}
        setDragging={setDragging}
        onReset={() => {
          void resetEq(getMicTarget(micKey))
          if (jointDebugging) {
            void resetEq(getMicTarget(getOtherMicKey(micKey)))
          }
        }}
        onBypassChange={(pressed) => {
          queueEqBypass(getMicTarget(micKey), pressed)
          if (jointDebugging) {
            queueEqBypass(getMicTarget(getOtherMicKey(micKey)), pressed)
          }
        }}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {showParamsCard && (
          <ParameterCard className="md:col-span-2" contentClassName="sm:grid-cols-2 md:grid-cols-4">
            {hasNumber(micDb.micAVolume) && (
              <NumberControl
                label="Mic A Volume"
                value={micDb.micAVolume ?? undefined}
                {...micRanges.micAVolume}
                disabled={disabled}
                onChange={(value) => queueMic({ micAVolume: Math.round(value) })}
              />
            )}
            {hasNumber(micDb.micBVolume) && (
              <NumberControl
                label="Mic B Volume"
                value={micDb.micBVolume ?? undefined}
                {...micRanges.micBVolume}
                disabled={disabled}
                onChange={(value) => queueMic({ micBVolume: Math.round(value) })}
              />
            )}

            {hasEnum(micDb.micFBX, webhmi.FbxMode) && (
              <div className="sm:col-span-2 md:col-span-4">
                <ToggleGroupControl
                  label="Mic FBX"
                  value={micFbxValue}
                  options={micFbxOptions}
                  disabled={disabled}
                  onChange={(value) => {
                    const parsed = Number(value)
                    if (!Number.isNaN(parsed)) queueMic({ micFBX: parsed as webhmi.FbxMode })
                  }}
                />
              </div>
            )}
            {hasNumber(micDb.bass) && (
              <NumberControl
                label="Bass"
                value={micDb.bass ?? undefined}
                {...micRanges.bass}
                disabled={disabled}
                onChange={(value) => queueMic({ bass: value })}
              />
            )}
            {hasNumber(micDb.mid) && (
              <NumberControl
                label="Mid"
                value={micDb.mid ?? undefined}
                {...micRanges.mid}
                disabled={disabled}
                onChange={(value) => queueMic({ mid: value })}
              />
            )}
            {hasNumber(micDb.midFreq) && (
              <NumberControl
                label="Mid Freq (Hz)"
                value={micDb.midFreq ?? undefined}
                {...micRanges.midFreq}
                disabled={disabled}
                onChange={(value) => queueMic({ midFreq: value })}
              />
            )}
            {hasNumber(micDb.treble) && (
              <NumberControl
                label="Treble"
                value={micDb.treble ?? undefined}
                {...micRanges.treble}
                disabled={disabled}
                onChange={(value) => queueMic({ treble: value })}
              />
            )}
          </ParameterCard>
        )}
        {showNoiseCard && (
          <ParameterCard title="Noise Gate" contentClassName="sm:grid-cols-2">
            {hasNumber(micDb.noise?.gate) && (
              <NumberControl
                label="Gate"
                value={micDb.noise?.gate ?? undefined}
                {...micRanges.noise.gate}
                disabled={disabled}
                onChange={(value) => queueMic({ noise: { gate: value } })}
              />
            )}
            {hasNumber(micDb.noise?.frameTime) && (
              <NumberControl
                label="Frame Time"
                value={micDb.noise?.frameTime ?? undefined}
                {...micRanges.noise.frameTime}
                disabled={disabled}
                onChange={(value) => queueMic({ noise: { frameTime: Math.round(value) } })}
              />
            )}
            {hasNumber(micDb.noise?.atkTime) && (
              <NumberControl
                label="Attack Time"
                value={micDb.noise?.atkTime ?? undefined}
                {...micRanges.noise.atkTime}
                disabled={disabled}
                onChange={(value) => queueMic({ noise: { atkTime: Math.round(value) } })}
              />
            )}
            {hasNumber(micDb.noise?.relTime) && (
              <NumberControl
                label="Release Time"
                value={micDb.noise?.relTime ?? undefined}
                {...micRanges.noise.relTime}
                disabled={disabled}
                onChange={(value) => queueMic({ noise: { relTime: Math.round(value) } })}
              />
            )}
          </ParameterCard>
        )}
        {showCompressorCard && (
          <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
            {hasAny(micDb.compressor?.threshold, micDb.compressor?.ratio, micDb.compressor?.attack, micDb.compressor?.release) && (
              <div className="sm:col-span-2">
                <CompressorGraph
                  threshold={micDb.compressor?.threshold}
                  ratio={micDb.compressor?.ratio}
                  attack={micDb.compressor?.attack}
                  release={micDb.compressor?.release}
                  thresholdRange={micRanges.compressor.threshold}
                  disabled={disabled}
                />
              </div>
            )}
            {hasNumber(micDb.compressor?.threshold) && (
              <NumberControl
                label="Threshold"
                value={micDb.compressor?.threshold ?? undefined}
                {...micRanges.compressor.threshold}
                disabled={disabled}
                onChange={(value) => queueMic({ compressor: { threshold: value } })}
              />
            )}
            {hasNumber(micDb.compressor?.ratio) && (
              <NumberControl
                label="Ratio"
                value={micDb.compressor?.ratio ?? undefined}
                {...micRanges.compressor.ratio}
                disabled={disabled}
                onChange={(value) => queueMic({ compressor: { ratio: Math.round(value) } })}
              />
            )}
            {hasNumber(micDb.compressor?.attack) && (
              <NumberControl
                label="Attack"
                value={micDb.compressor?.attack ?? undefined}
                {...micRanges.compressor.attack}
                disabled={disabled}
                onChange={(value) => queueMic({ compressor: { attack: Math.round(value) } })}
              />
            )}
            {hasNumber(micDb.compressor?.release) && (
              <NumberControl
                label="Release"
                value={micDb.compressor?.release ?? undefined}
                {...micRanges.compressor.release}
                disabled={disabled}
                onChange={(value) => queueMic({ compressor: { release: Math.round(value) } })}
              />
            )}
            {hasBoolean(micDb.compressor?.bypass) && (
              <ToggleControl
                label="Bypass"
                pressed={micDb.compressor?.bypass}
                disabled={disabled}
                onChange={(pressed) => queueMic({ compressor: { bypass: pressed } })}
              />
            )}
          </ParameterCard>
        )}
      </div>
    </div>
  )
}
