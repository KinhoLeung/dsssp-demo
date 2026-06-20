/* eslint-disable no-use-before-define */
import type { ReactNode } from 'react'

import { CompressorGraph } from './CompressorGraph'
import { DspPanel, type DspPanelProps } from './DspPanel'
import { hasAny, hasBoolean, hasNumber, type PanelState } from './dspUtils'
import { NumberControl } from './NumberControl'
import { ParameterCard } from './ParameterCard'
import { PhaseInversionToggle } from './PhaseInversionToggle'
import { ToggleControl } from './ToggleControl'
import { mixerPatchForScene } from './useOutputScene'

import type { buildParameterRanges } from '@/configs/parameterRanges'
import type { webhmi } from '@/device/proto/generated/webhmi'

type ParameterRanges = ReturnType<typeof buildParameterRanges>
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

type CommonOutputPanelProps = EqPanelBindings & {
  panelState: PanelState
  panelPower: Pick<DspPanelProps, 'powered' | 'bypass'>
  headerExtra?: ReactNode
  sceneMode: webhmi.OutputSceneMode
  disabled: boolean
  eqDisabled: boolean
  mixerDisabled: boolean
  target: webhmi.EqTarget
  mixer: webhmi.IMixer | null
  resetEq: (target: webhmi.EqTarget, indices?: number[], sceneMode?: webhmi.OutputSceneMode) => void | Promise<unknown>
  queueEqBypass: (target: webhmi.EqTarget, bypass: boolean, sceneMode?: webhmi.OutputSceneMode) => void
}

type MainOutputPanelProps = CommonOutputPanelProps & {
  kind: 'mainoutput'
  outputDb: webhmi.IMainOutputDb
  ranges: ParameterRanges['mainOutput']
  queueOutput: (patch: webhmi.ISetMainOutputRequest) => void
}

type SubOutputPanelProps = CommonOutputPanelProps & {
  kind: 'suboutput'
  outputDb: webhmi.ISubOutputDb
  ranges: ParameterRanges['subOutput']
  queueOutput: (patch: webhmi.ISetSubOutputRequest) => void
}

type CenterOutputPanelProps = CommonOutputPanelProps & {
  kind: 'center'
  outputDb: webhmi.ICenterDb
  ranges: ParameterRanges['center']
  queueOutput: (patch: webhmi.ISetCenterRequest) => void
}

type SurroundOutputPanelProps = CommonOutputPanelProps & {
  kind: 'surround'
  outputDb: webhmi.ISurroundDb
  ranges: ParameterRanges['surround']
  queueOutput: (patch: webhmi.ISetSurroundRequest) => void
}

export type OutputPanelProps =
  | MainOutputPanelProps
  | SubOutputPanelProps
  | CenterOutputPanelProps
  | SurroundOutputPanelProps

export function OutputPanel(props: OutputPanelProps) {
  const {
    panelState,
    panelPower,
    headerExtra,
    sceneMode,
    disabled,
    eqDisabled,
    mixerDisabled,
    target,
    mixer,
    activeIndex,
    dragging,
    handleFilterChange,
    handlePointDoubleClick,
    handleMouseEnter,
    handleMouseLeave,
    setDragging,
    resetEq,
    queueEqBypass,
  } = props

  return (
    <div className="flex flex-col gap-4">
      <DspPanel
        {...panelPower}
        eqRange={props.ranges.eq}
        filters={panelState.filters}
        allowedTypesByUiIndex={panelState.allowedTypesByUiIndex}
        pointIndexByUiIndex={panelState.pointIndexByUiIndex}
        activeIndex={activeIndex}
        dragging={dragging}
        disabled={eqDisabled}
        handleFilterChange={handleFilterChange}
        handlePointDoubleClick={handlePointDoubleClick}
        handleMouseEnter={handleMouseEnter}
        handleMouseLeave={handleMouseLeave}
        setDragging={setDragging}
        headerExtra={headerExtra}
        onReset={() => void resetEq(target, undefined, sceneMode)}
        onBypassChange={(pressed) => queueEqBypass(target, pressed, sceneMode)}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(props.kind === 'mainoutput' || props.kind === 'surround') && (
          <StereoOutputCard
            output={props.outputDb.output ?? null}
            ranges={props.ranges.output}
            disabled={disabled}
            queueOutput={(patch) => props.queueOutput({ output: patch })}
          />
        )}
        {(props.kind === 'suboutput' || props.kind === 'center') && (
          <MonoOutputCard
            output={props.outputDb.output ?? null}
            ranges={props.ranges.output}
            disabled={disabled}
            queueOutput={(patch) => props.queueOutput({ output: patch })}
          />
        )}
        <MixerCard
          mixer={mixer}
          ranges={props.ranges.mixer}
          disabled={mixerDisabled}
          queueMixer={(patch) => props.queueOutput(mixerPatchForScene(sceneMode, patch))}
        />
        <CompressorCard
          compressor={props.outputDb.compressor ?? null}
          ranges={props.ranges.compressor}
          disabled={disabled}
          queueCompressor={(patch) => props.queueOutput({ compressor: patch })}
        />
      </div>
    </div>
  )
}

function StereoOutputCard({
  output,
  ranges,
  disabled,
  queueOutput,
}: {
  output: webhmi.IStereoOutput | null
  ranges: ParameterRanges['mainOutput']['output'] | ParameterRanges['surround']['output']
  disabled: boolean
  queueOutput: (patch: webhmi.IStereoOutputPatch) => void
}) {
  const showCard =
    !!output &&
    hasAny(
      output.leftChannelVolume,
      output.rightChannelVolume,
      output.leftDelay,
      output.rightDelay,
      output.leftMute,
      output.rightMute,
    )
  if (!showCard) return null

  return (
    <ParameterCard title="Output" contentClassName="sm:grid-cols-2">
      {hasNumber(output.leftChannelVolume) && (
        <NumberControl
          label="Left Volume"
          value={output.leftChannelVolume ?? undefined}
          {...ranges.leftChannelVolume}
          disabled={disabled}
          onChange={(value) => queueOutput({ leftChannelVolume: value })}
          extra={
            hasBoolean(output.leftChannelVolumePhaseInversion) && (
              <PhaseInversionToggle
                pressed={output.leftChannelVolumePhaseInversion}
                disabled={disabled}
                onChange={(pressed) => queueOutput({ leftChannelVolumePhaseInversion: pressed })}
              />
            )
          }
        />
      )}
      {hasNumber(output.rightChannelVolume) && (
        <NumberControl
          label="Right Volume"
          value={output.rightChannelVolume ?? undefined}
          {...ranges.rightChannelVolume}
          disabled={disabled}
          onChange={(value) => queueOutput({ rightChannelVolume: value })}
          extra={
            hasBoolean(output.rightChannelVolumePhaseInversion) && (
              <PhaseInversionToggle
                pressed={output.rightChannelVolumePhaseInversion}
                disabled={disabled}
                onChange={(pressed) => queueOutput({ rightChannelVolumePhaseInversion: pressed })}
              />
            )
          }
        />
      )}
      {hasNumber(output.leftDelay) && (
        <NumberControl
          label="Left Delay"
          value={output.leftDelay ?? undefined}
          {...ranges.leftDelay}
          disabled={disabled}
          onChange={(value) => queueOutput({ leftDelay: value })}
        />
      )}
      {hasNumber(output.rightDelay) && (
        <NumberControl
          label="Right Delay"
          value={output.rightDelay ?? undefined}
          {...ranges.rightDelay}
          disabled={disabled}
          onChange={(value) => queueOutput({ rightDelay: value })}
        />
      )}
      {hasBoolean(output.leftMute) && (
        <ToggleControl
          label="Left Mute"
          pressed={output.leftMute}
          disabled={disabled}
          onChange={(pressed) => queueOutput({ leftMute: pressed })}
        />
      )}
      {hasBoolean(output.rightMute) && (
        <ToggleControl
          label="Right Mute"
          pressed={output.rightMute}
          disabled={disabled}
          onChange={(pressed) => queueOutput({ rightMute: pressed })}
        />
      )}
    </ParameterCard>
  )
}

function MonoOutputCard({
  output,
  ranges,
  disabled,
  queueOutput,
}: {
  output: webhmi.IMonoOutput | null
  ranges: ParameterRanges['subOutput']['output'] | ParameterRanges['center']['output']
  disabled: boolean
  queueOutput: (patch: webhmi.IMonoOutputPatch) => void
}) {
  const showCard = !!output && hasAny(output.volume, output.delay, output.mute)
  if (!showCard) return null

  return (
    <ParameterCard title="Output" contentClassName="sm:grid-cols-2">
      {hasNumber(output.volume) && (
        <NumberControl
          label="Volume"
          value={output.volume ?? undefined}
          {...ranges.volume}
          disabled={disabled}
          onChange={(value) => queueOutput({ volume: value })}
          extra={
            hasBoolean(output.volumePhaseInversion) && (
              <PhaseInversionToggle
                pressed={output.volumePhaseInversion}
                disabled={disabled}
                onChange={(pressed) => queueOutput({ volumePhaseInversion: pressed })}
              />
            )
          }
        />
      )}
      {hasNumber(output.delay) && (
        <NumberControl
          label="Delay"
          value={output.delay ?? undefined}
          {...ranges.delay}
          disabled={disabled}
          onChange={(value) => queueOutput({ delay: value })}
        />
      )}
      {hasBoolean(output.mute) && (
        <ToggleControl
          label="Mute"
          pressed={output.mute}
          disabled={disabled}
          onChange={(pressed) => queueOutput({ mute: pressed })}
        />
      )}
    </ParameterCard>
  )
}

function MixerCard({
  mixer,
  ranges,
  disabled,
  queueMixer,
}: {
  mixer: webhmi.IMixer | null
  ranges: ParameterRanges['mainOutput']['mixer']
  disabled: boolean
  queueMixer: (patch: webhmi.IMixerPatch) => void
}) {
  const showCard = !!mixer && hasAny(mixer.micDirectLevel, mixer.musicLevel, mixer.reverbLevel, mixer.echoLevel)
  if (!showCard) return null

  return (
    <ParameterCard title="Mixer" contentClassName="sm:grid-cols-2">
      {hasNumber(mixer.micDirectLevel) && (
        <NumberControl
          label="Mic Direct Level"
          value={mixer.micDirectLevel ?? undefined}
          {...ranges.micDirectLevel}
          disabled={disabled}
          onChange={(value) => queueMixer({ micDirectLevel: Math.round(value) })}
          extra={
            hasBoolean(mixer.micDirectLevelPhaseInversion) && (
              <PhaseInversionToggle
                pressed={mixer.micDirectLevelPhaseInversion}
                disabled={disabled}
                onChange={(pressed) => queueMixer({ micDirectLevelPhaseInversion: pressed })}
              />
            )
          }
        />
      )}
      {hasNumber(mixer.musicLevel) && (
        <NumberControl
          label="Music Level"
          value={mixer.musicLevel ?? undefined}
          {...ranges.musicLevel}
          disabled={disabled}
          onChange={(value) => queueMixer({ musicLevel: Math.round(value) })}
          extra={
            hasBoolean(mixer.musicLevelPhaseInversion) && (
              <PhaseInversionToggle
                pressed={mixer.musicLevelPhaseInversion}
                disabled={disabled}
                onChange={(pressed) => queueMixer({ musicLevelPhaseInversion: pressed })}
              />
            )
          }
        />
      )}
      {hasNumber(mixer.reverbLevel) && (
        <NumberControl
          label="Reverb Level"
          value={mixer.reverbLevel ?? undefined}
          {...ranges.reverbLevel}
          disabled={disabled}
          onChange={(value) => queueMixer({ reverbLevel: Math.round(value) })}
          extra={
            hasBoolean(mixer.reverbLevelPhaseInversion) && (
              <PhaseInversionToggle
                pressed={mixer.reverbLevelPhaseInversion}
                disabled={disabled}
                onChange={(pressed) => queueMixer({ reverbLevelPhaseInversion: pressed })}
              />
            )
          }
        />
      )}
      {hasNumber(mixer.echoLevel) && (
        <NumberControl
          label="Echo Level"
          value={mixer.echoLevel ?? undefined}
          {...ranges.echoLevel}
          disabled={disabled}
          onChange={(value) => queueMixer({ echoLevel: Math.round(value) })}
          extra={
            hasBoolean(mixer.echoLevelPhaseInversion) && (
              <PhaseInversionToggle
                pressed={mixer.echoLevelPhaseInversion}
                disabled={disabled}
                onChange={(pressed) => queueMixer({ echoLevelPhaseInversion: pressed })}
              />
            )
          }
        />
      )}
    </ParameterCard>
  )
}

function CompressorCard({
  compressor,
  ranges,
  disabled,
  queueCompressor,
}: {
  compressor: webhmi.ICompressor | null
  ranges: ParameterRanges['mainOutput']['compressor']
  disabled: boolean
  queueCompressor: (patch: webhmi.ICompressorPatch) => void
}) {
  const showCard =
    !!compressor &&
    hasAny(compressor.threshold, compressor.ratio, compressor.attack, compressor.release, compressor.bypass)
  if (!showCard) return null

  return (
    <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
      {hasAny(compressor.threshold, compressor.ratio, compressor.attack, compressor.release) && (
        <div className="sm:col-span-2">
          <CompressorGraph
            threshold={compressor.threshold}
            ratio={compressor.ratio}
            attack={compressor.attack}
            release={compressor.release}
            thresholdRange={ranges.threshold}
            disabled={disabled}
          />
        </div>
      )}
      {hasNumber(compressor.threshold) && (
        <NumberControl
          label="Threshold"
          value={compressor.threshold ?? undefined}
          {...ranges.threshold}
          disabled={disabled}
          onChange={(value) => queueCompressor({ threshold: value })}
        />
      )}
      {hasNumber(compressor.ratio) && (
        <NumberControl
          label="Ratio"
          value={compressor.ratio ?? undefined}
          {...ranges.ratio}
          disabled={disabled}
          onChange={(value) => queueCompressor({ ratio: Math.round(value) })}
        />
      )}
      {hasNumber(compressor.attack) && (
        <NumberControl
          label="Attack"
          value={compressor.attack ?? undefined}
          {...ranges.attack}
          disabled={disabled}
          onChange={(value) => queueCompressor({ attack: Math.round(value) })}
        />
      )}
      {hasNumber(compressor.release) && (
        <NumberControl
          label="Release"
          value={compressor.release ?? undefined}
          {...ranges.release}
          disabled={disabled}
          onChange={(value) => queueCompressor({ release: Math.round(value) })}
        />
      )}
      {hasBoolean(compressor.bypass) && (
        <ToggleControl
          label="Bypass"
          pressed={compressor.bypass}
          disabled={disabled}
          onChange={(pressed) => queueCompressor({ bypass: pressed })}
        />
      )}
    </ParameterCard>
  )
}
