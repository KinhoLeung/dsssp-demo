import type { ReactNode } from 'react'

import { DspPanel, type DspPanelProps } from './DspPanel'
import { hasAny, hasBoolean, hasNumber, type PanelState } from './dspUtils'
import { NumberControl } from './NumberControl'
import { ParameterCard } from './ParameterCard'
import { PhaseInversionToggle } from './PhaseInversionToggle'

import type { buildParameterRanges } from '@/configs/parameterRanges'
import { webhmi } from '@/device/proto/generated/webhmi'

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

type CommonEffectPanelProps = EqPanelBindings & {
  panelState: PanelState
  panelPower: Pick<DspPanelProps, 'powered' | 'bypass'>
  disabled: boolean
  resetEq: (target: webhmi.EqTarget) => void | Promise<unknown>
  queueEqBypass: (target: webhmi.EqTarget, bypass: boolean) => void
}

type ReverbPanelProps = CommonEffectPanelProps & {
  kind: 'reverb'
  effectDb: webhmi.IReverbDb
  ranges: ParameterRanges['reverb']
  queueEffect: (patch: webhmi.ISetReverbRequest) => void
}

type EchoPanelProps = CommonEffectPanelProps & {
  kind: 'echo'
  effectDb: webhmi.IEchoDb
  ranges: ParameterRanges['echo']
  queueEffect: (patch: webhmi.ISetEchoRequest) => void
}

type EffectShellProps = CommonEffectPanelProps & {
  target: webhmi.EqTarget
  eqRange: DspPanelProps['eqRange']
  controls: ReactNode
}

function EffectShell({
  target,
  eqRange,
  controls,
  panelState,
  panelPower,
  activeIndex,
  dragging,
  handleFilterChange,
  handlePointDoubleClick,
  handleMouseEnter,
  handleMouseLeave,
  setDragging,
  resetEq,
  queueEqBypass,
}: EffectShellProps) {
  return (
    <div className="flex flex-col gap-4">
      <DspPanel
        {...panelPower}
        eqRange={eqRange}
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
        onReset={() => void resetEq(target)}
        onBypassChange={(pressed) => queueEqBypass(target, pressed)}
      />
      <div className="grid gap-4 md:grid-cols-2">{controls}</div>
    </div>
  )
}

export type EffectPanelProps = ReverbPanelProps | EchoPanelProps

export function EffectPanel(props: EffectPanelProps) {
  if (props.kind === 'reverb') {
    const { effectDb, ranges, queueEffect } = props
    const showCard = hasAny(effectDb.reverbLevel, effectDb.micDirectLevel, effectDb.reverbPredelay, effectDb.reverbDecay)

    return (
      <EffectShell
        {...props}
        target={webhmi.EqTarget.REVERB}
        eqRange={ranges.eq}
        controls={
          showCard && (
            <ParameterCard title="Reverb" className="md:col-span-2" contentClassName="sm:grid-cols-2">
              {hasNumber(effectDb.reverbLevel) && (
                <NumberControl
                  label="Reverb Level"
                  value={effectDb.reverbLevel ?? undefined}
                  {...ranges.reverbLevel}
                  disabled={props.disabled}
                  onChange={(value) => queueEffect({ reverbLevel: Math.round(value) })}
                  extra={
                    hasBoolean(effectDb.reverbLevelPhaseInversion) && (
                      <PhaseInversionToggle
                        pressed={effectDb.reverbLevelPhaseInversion}
                        disabled={props.disabled}
                        onChange={(pressed) => queueEffect({ reverbLevelPhaseInversion: pressed })}
                      />
                    )
                  }
                />
              )}
              {hasNumber(effectDb.micDirectLevel) && (
                <NumberControl
                  label="Mic Direct Level"
                  value={effectDb.micDirectLevel ?? undefined}
                  {...ranges.micDirectLevel}
                  disabled={props.disabled}
                  onChange={(value) => queueEffect({ micDirectLevel: Math.round(value) })}
                  extra={
                    hasBoolean(effectDb.micDirectLevelPhaseInversion) && (
                      <PhaseInversionToggle
                        pressed={effectDb.micDirectLevelPhaseInversion}
                        disabled={props.disabled}
                        onChange={(pressed) => queueEffect({ micDirectLevelPhaseInversion: pressed })}
                      />
                    )
                  }
                />
              )}
              {hasNumber(effectDb.reverbPredelay) && (
                <NumberControl
                  label="Pre-delay"
                  value={effectDb.reverbPredelay ?? undefined}
                  {...ranges.reverbPredelay}
                  disabled={props.disabled}
                  onChange={(value) => queueEffect({ reverbPredelay: Math.round(value) })}
                />
              )}
              {hasNumber(effectDb.reverbDecay) && (
                <NumberControl
                  label="Decay"
                  value={effectDb.reverbDecay ?? undefined}
                  {...ranges.reverbDecay}
                  disabled={props.disabled}
                  onChange={(value) => queueEffect({ reverbDecay: Math.round(value) })}
                />
              )}
            </ParameterCard>
          )
        }
      />
    )
  }

  const { effectDb, ranges, queueEffect } = props
  const showCard = hasAny(
    effectDb.echoLevel,
    effectDb.micDirectLevel,
    effectDb.echoPredelay,
    effectDb.echoDelayTime,
    effectDb.echoRepeat,
    effectDb.echoRightPredelay,
    effectDb.echoRightDelay,
  )

  return (
    <EffectShell
      {...props}
      target={webhmi.EqTarget.ECHO}
      eqRange={ranges.eq}
      controls={
        showCard && (
          <ParameterCard title="Echo" className="md:col-span-2" contentClassName="sm:grid-cols-2 lg:grid-cols-3">
            {hasNumber(effectDb.echoLevel) && (
              <NumberControl
                label="Echo Level"
                value={effectDb.echoLevel ?? undefined}
                {...ranges.echoLevel}
                disabled={props.disabled}
                onChange={(value) => queueEffect({ echoLevel: Math.round(value) })}
                extra={
                  hasBoolean(effectDb.echoLevelPhaseInversion) && (
                    <PhaseInversionToggle
                      pressed={effectDb.echoLevelPhaseInversion}
                      disabled={props.disabled}
                      onChange={(pressed) => queueEffect({ echoLevelPhaseInversion: pressed })}
                    />
                  )
                }
              />
            )}
            {hasNumber(effectDb.micDirectLevel) && (
              <NumberControl
                label="Mic Direct Level"
                value={effectDb.micDirectLevel ?? undefined}
                {...ranges.micDirectLevel}
                disabled={props.disabled}
                onChange={(value) => queueEffect({ micDirectLevel: Math.round(value) })}
                extra={
                  hasBoolean(effectDb.micDirectLevelPhaseInversion) && (
                    <PhaseInversionToggle
                      pressed={effectDb.micDirectLevelPhaseInversion}
                      disabled={props.disabled}
                      onChange={(pressed) => queueEffect({ micDirectLevelPhaseInversion: pressed })}
                    />
                  )
                }
              />
            )}
            {hasNumber(effectDb.echoPredelay) && (
              <NumberControl
                label="Pre-delay"
                value={effectDb.echoPredelay ?? undefined}
                {...ranges.echoPredelay}
                disabled={props.disabled}
                onChange={(value) => queueEffect({ echoPredelay: Math.round(value) })}
              />
            )}
            {hasNumber(effectDb.echoDelayTime) && (
              <NumberControl
                label="Delay Time"
                value={effectDb.echoDelayTime ?? undefined}
                {...ranges.echoDelayTime}
                disabled={props.disabled}
                onChange={(value) => queueEffect({ echoDelayTime: Math.round(value) })}
              />
            )}
            {hasNumber(effectDb.echoRepeat) && (
              <NumberControl
                label="Repeat"
                value={effectDb.echoRepeat ?? undefined}
                {...ranges.echoRepeat}
                disabled={props.disabled}
                onChange={(value) => queueEffect({ echoRepeat: Math.round(value) })}
              />
            )}
            {hasNumber(effectDb.echoRightPredelay) && (
              <NumberControl
                label="Right Pre-delay"
                value={effectDb.echoRightPredelay ?? undefined}
                {...ranges.echoRightPredelay}
                disabled={props.disabled}
                onChange={(value) => queueEffect({ echoRightPredelay: Math.round(value) })}
              />
            )}
            {hasNumber(effectDb.echoRightDelay) && (
              <NumberControl
                label="Right Delay"
                value={effectDb.echoRightDelay ?? undefined}
                {...ranges.echoRightDelay}
                disabled={props.disabled}
                onChange={(value) => queueEffect({ echoRightDelay: Math.round(value) })}
              />
            )}
          </ParameterCard>
        )
      }
    />
  )
}
