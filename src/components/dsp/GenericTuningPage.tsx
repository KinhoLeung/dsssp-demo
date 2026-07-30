import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import {
  uiTextKey,
  type PanelKey,
  type MainTabKey,
  type PanelDef,
  type SelectOption,
} from './dspUtils'
import { EffectPanel } from './EffectPanel'
import { ToggleControl } from './index'
import { MicPanel, type MicPanelKey } from './MicPanel'
import { MusicPanel } from './MusicPanel'
import { OutputPanel } from './OutputPanel'
import { PreciseValueButton } from './PreciseValueButton'
import { SystemPanel } from './SystemPanel'
import { useConfigImportExport } from './useConfigImportExport'
import { useEqPanelState } from './useEqPanelState'
import {
  getOutputEqForScene,
  getOutputMixerForScene,
  getSceneModeFromConfig,
} from './useOutputScene'
import { buildTuningVisibility, getInitialTuningTab } from './visibilityRules'

import { AbstractlySlider } from '@/components/AbstractlySlider'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { buildParameterRanges, clampToRange, type RangeConfig, withRangeBounds } from '@/configs/parameterRanges'
import { webhmi } from '@/device/proto/generated/webhmi'
import { formatDeviceErrorMessage } from '@/device/utils/errorMessages'
import { toast } from '@/hooks/use-toast'
import { useTuningState } from '@/hooks/useTuningState'

// Shared DSP UI components

export type GenericTuningPageProps = {
  isDemoMode: boolean
}

type SystemVolumeSliderProps = {
  label: string
  value?: number | null
  range: RangeConfig
  disabled?: boolean
  uiText: (text: string) => string
  onChange: (value: number) => void
}

function SystemVolumeSlider({
  label,
  value,
  range,
  disabled,
  uiText,
  onChange,
}: SystemVolumeSliderProps) {
  const hasValue = typeof value === 'number' && Number.isFinite(value)
  const currentValue = hasValue
    ? clampToRange(value, range)
    : range.min
  const translatedLabel = uiText(label)

  return (
    <div className="w-36 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs text-muted-foreground font-medium">{translatedLabel}</Label>
        <PreciseValueButton
          label={translatedLabel}
          value={currentValue}
          hasValue={hasValue}
          min={range.min}
          max={range.max}
          step={range.step}
          disabled={disabled}
          onCommit={onChange}
        />
      </div>
      <AbstractlySlider
        orientation="horizontal"
        value={currentValue}
        min={range.min}
        max={range.max}
        step={range.step}
        disabled={disabled}
        showLed={false}
        className="ab-slider--no-shell ab-slider--dark"
        aria-label={translatedLabel}
        onChange={onChange}
        style={
          {
            '--ab-slider-width': '144px',
            '--ab-slider-min-height': '34px',
            '--ab-slider-innerplate-width': '144px',
            '--ab-slider-innerplate-min-height': '32px',
            '--ab-slider-innerplate-padding-y': '10px',
            '--ab-slider-track-width': '124px',
            '--ab-slider-track-height': '6px',
            '--ab-slider-handle-width': '54px',
            '--ab-slider-handle-height': '25px',
            '--ab-slider-handle-offset-y': '-10px',
          } as CSSProperties
        }
      />
    </div>
  )
}

export function GenericTuningPage({ isDemoMode }: GenericTuningPageProps) {
  const { t } = useTranslation()
  const ns = isDemoMode ? 'demoMode' : 'deviceDemo'

  const { state, actions } = useTuningState(isDemoMode)
  const disconnect = actions.disconnect
  const didMountOnceRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uiText = useCallback(
    (text: string) => t(`uiText.${uiTextKey(text)}`, { defaultValue: text }),
    [t],
  )

  const {
    isExportDialogOpen,
    setIsExportDialogOpen,
    exportFilename,
    setExportFilename,
    performExport,
    handleExport,
    isImportConfirmOpen,
    setIsImportConfirmOpen,
    pendingImportData,
    importValidation,
    confirmPendingImport,
    handleImport,
  } = useConfigImportExport({
    db: state.db,
    ns,
    t,
    uiText,
    applyImportData: actions.applyImportData,
  })

  useEffect(() => {
    const shouldDisconnectOnCleanup = didMountOnceRef.current
    didMountOnceRef.current = true
    return () => {
      if (!shouldDisconnectOnCleanup) return
      void disconnect()
    }
  }, [disconnect])

  const lastToastErrorRef = useRef('')
  useEffect(() => {
    if (isDemoMode || !state.error || state.error === lastToastErrorRef.current) return
    lastToastErrorRef.current = state.error
    toast.destructive({
      title: t('toast.deviceCommandFailed.title'),
      description: formatDeviceErrorMessage(state.error, t),
    })
  }, [isDemoMode, state.error, t])

  const panels: PanelDef[] = useMemo(
    () => [
      { key: 'music', label: uiText('Music'), target: webhmi.EqTarget.MUSIC, getEq: (db) => db?.db?.music?.eq ?? null },
      { key: 'mica', label: uiText('Mic'), target: webhmi.EqTarget.MIC_A, getEq: (db) => db?.db?.mic?.micAEq?.eq ?? null },
      { key: 'micb', label: uiText('Mic'), target: webhmi.EqTarget.MIC_B, getEq: (db) => db?.db?.mic?.micBEq?.eq ?? null },
      { key: 'reverb', label: uiText('Reverb'), target: webhmi.EqTarget.REVERB, getEq: (db) => db?.db?.reverb?.eq ?? null },
      { key: 'echo', label: uiText('Echo'), target: webhmi.EqTarget.ECHO, getEq: (db) => db?.db?.echo?.eq ?? null },
      {
        key: 'mainoutput',
        label: uiText('Main Output'),
        target: webhmi.EqTarget.MAIN_OUTPUT,
        getEq: (db) => getOutputEqForScene(db?.db?.mainOutput, getSceneModeFromConfig(db)),
      },
      {
        key: 'suboutput',
        label: uiText('Sub Output'),
        target: webhmi.EqTarget.SUB_OUTPUT,
        getEq: (db) => getOutputEqForScene(db?.db?.subOutput, getSceneModeFromConfig(db)),
      },
      { key: 'center', label: uiText('Center'), target: webhmi.EqTarget.CENTER, getEq: (db) => getOutputEqForScene(db?.db?.center, getSceneModeFromConfig(db)) },
      {
        key: 'surround',
        label: uiText('Surround'),
        target: webhmi.EqTarget.SURROUND,
        getEq: (db) => getOutputEqForScene(db?.db?.surround, getSceneModeFromConfig(db)),
      },
    ],
    [uiText],
  )

  const panelByKey = useMemo(() => Object.fromEntries(panels.map((p) => [p.key, p])) as Record<PanelKey, PanelDef>, [panels])

  const db = state.db?.db ?? null
  const systemDb = db?.system ?? null
  const musicDb = db?.music ?? null
  const micDb = db?.mic ?? null
  const reverbDb = db?.reverb ?? null
  const echoDb = db?.echo ?? null
  const mainOutputDb = db?.mainOutput ?? null
  const subOutputDb = db?.subOutput ?? null
  const centerDb = db?.center ?? null
  const surroundDb = db?.surround ?? null
  const visibility = useMemo(() => buildTuningVisibility(db, state.authOk), [db, state.authOk])
  const {
    resolvedOutputControlMode,
    resolvedOutputSceneMode,
    showDanceModeCard,
    showSystemDefaultsCard,
    showSystemLimitsCard,
  } = visibility
  const mainOutputMixer = getOutputMixerForScene(mainOutputDb, resolvedOutputSceneMode)
  const subOutputMixer = getOutputMixerForScene(subOutputDb, resolvedOutputSceneMode)
  const centerMixer = getOutputMixerForScene(centerDb, resolvedOutputSceneMode)
  const surroundMixer = getOutputMixerForScene(surroundDb, resolvedOutputSceneMode)
  const ranges = useMemo(() => buildParameterRanges(db), [db])
  const {
    system: systemRanges,
    music: musicRanges,
    mic: micRanges,
    reverb: reverbRanges,
    echo: echoRanges,
    mainOutput: mainOutputRanges,
    subOutput: subOutputRanges,
    center: centerRanges,
    surround: surroundRanges,
  } = ranges
  const systemMusicVolumeRange = withRangeBounds(systemRanges.musicVolume, { max: systemDb?.musicMaxVolume })
  const systemMicVolumeRange = withRangeBounds(systemRanges.micVolume, { max: systemDb?.micMaxVolume })
  const systemEffectVolumeRange = withRangeBounds(systemRanges.effectVolume, { max: systemDb?.effectMaxVolume })
  const systemMusicDefaultVolumeRange = withRangeBounds(systemRanges.musicDefaultVolume, { max: systemDb?.musicMaxVolume })
  const systemMicDefaultVolumeRange = withRangeBounds(systemRanges.micDefaultVolume, { max: systemDb?.micMaxVolume })
  const systemEffectDefaultVolumeRange = withRangeBounds(systemRanges.effectDefaultVolume, { max: systemDb?.effectMaxVolume })
  const systemMusicMaxVolumeRange = withRangeBounds(systemRanges.musicMaxVolume, { min: systemDb?.musicDefaultVolume })
  const systemMicMaxVolumeRange = withRangeBounds(systemRanges.micMaxVolume, { min: systemDb?.micDefaultVolume })
  const systemEffectMaxVolumeRange = withRangeBounds(systemRanges.effectMaxVolume, { min: systemDb?.effectDefaultVolume })

  const systemModeValue = useMemo(() => {
    const index = systemDb?.currentModeIndex
    if (typeof index !== 'number') return undefined
    const modes = systemDb?.modeList ?? []
    if (index < 0 || index >= modes.length) return undefined
    return String(index)
  }, [systemDb?.currentModeIndex, systemDb?.modeList])
  const musicDisabled = visibility.disabled.music
  const micDisabled = visibility.disabled.mic
  const reverbDisabled = visibility.disabled.reverb
  const echoDisabled = visibility.disabled.echo
  const mainOutputDisabled = visibility.disabled.mainOutput
  const subOutputDisabled = visibility.disabled.subOutput
  const centerDisabled = visibility.disabled.center
  const surroundDisabled = visibility.disabled.surround
  const mainOutputEqDisabled = visibility.disabled.mainOutputEq
  const subOutputEqDisabled = visibility.disabled.subOutputEq
  const centerEqDisabled = visibility.disabled.centerEq
  const surroundEqDisabled = visibility.disabled.surroundEq
  const mainOutputMixerDisabled = visibility.disabled.mainOutputMixer
  const subOutputMixerDisabled = visibility.disabled.subOutputMixer
  const centerMixerDisabled = visibility.disabled.centerMixer
  const surroundMixerDisabled = visibility.disabled.surroundMixer
  const systemDisabled = visibility.disabled.system

  const systemModeOptions = useMemo<SelectOption[]>(() => {
    const modes = systemDb?.modeList ?? []
    return modes.map((label, index) => ({ value: String(index), label }))
  }, [systemDb?.modeList])

  const outputModeControls = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        value={String(resolvedOutputControlMode)}
        onValueChange={(value) => {
          if (!value) return
          actions.queueSystem({ controlMode: Number(value) as webhmi.OutputControlMode })
        }}
        disabled={systemDisabled}
        className="gap-0"
      >
        <ToggleGroupItem value={String(webhmi.OutputControlMode.OUTPUT_CONTROL_AUTO)} className="rounded-r-none">
          {uiText('Auto')}
        </ToggleGroupItem>
        <ToggleGroupItem value={String(webhmi.OutputControlMode.OUTPUT_CONTROL_MANUAL)} className="rounded-l-none border-l-0">
          {uiText('Manual')}
        </ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        type="single"
        variant="outline"
        value={String(resolvedOutputSceneMode)}
        onValueChange={(value) => {
          if (!value) return
          actions.queueSystem({ sceneMode: Number(value) as webhmi.OutputSceneMode })
        }}
        disabled={systemDisabled}
        className="gap-0"
      >
        <ToggleGroupItem value={String(webhmi.OutputSceneMode.OUTPUT_SCENE_SING)} className="rounded-r-none">
          {uiText('Sing')}
        </ToggleGroupItem>
        <ToggleGroupItem value={String(webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE)} className="rounded-l-none border-l-0">
          {uiText('Dance')}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )

  const [isBleRenameDialogOpen, setIsBleRenameDialogOpen] = useState(false)
  const [bleNameDraft, setBleNameDraft] = useState('')
  useEffect(() => {
    const next = systemDb?.bleName ?? ''
    setBleNameDraft((prev) => (prev === next ? prev : next))
  }, [systemDb?.bleName])

  const [isModeRenameDialogOpen, setIsModeRenameDialogOpen] = useState(false)
  const [modeNamesDraft, setModeNamesDraft] = useState<string[]>([])
  useEffect(() => {
    if (!isModeRenameDialogOpen) {
      setModeNamesDraft(systemDb?.modeList ?? [])
    }
  }, [systemDb?.modeList, isModeRenameDialogOpen])

  const [isSaveModeDialogOpen, setIsSaveModeDialogOpen] = useState(false)
  const [saveTargetModeIndex, setSaveTargetModeIndex] = useState<number>(0)
  useEffect(() => {
    if (typeof systemDb?.currentModeIndex === 'number') {
      setSaveTargetModeIndex(systemDb.currentModeIndex)
    }
  }, [systemDb?.currentModeIndex, isSaveModeDialogOpen])

  const {
    panelStateByKey,
    dragging,
    activeIndex,
    setDragging,
    handleMouseLeave,
    handleMouseEnter,
    handleFilterChangeByKey,
    handlePointDoubleClickByKey,
    getPanelPower,
  } = useEqPanelState({
    panels,
    panelByKey,
    db: state.db,
    dbFetchId: state.dbFetchId,
    actions,
  })

  const [micKey, setMicKey] = useState<MicPanelKey>('mica')
  const hasMicA = visibility.hasMicA
  const hasMicB = visibility.hasMicB
  const showMicSelector = visibility.showMicSelector

  useEffect(() => {
    const desired: MicPanelKey = hasMicA ? 'mica' : hasMicB ? 'micb' : 'mica'
    if ((micKey === 'mica' && !hasMicA && hasMicB) || (micKey === 'micb' && !hasMicB && hasMicA)) {
      setMicKey(desired)
    }
    if (!hasMicA && !hasMicB && micKey !== 'mica') setMicKey('mica')
  }, [hasMicA, hasMicB, micKey])

  const availableTabs = visibility.availableTabs

  const [activeTab, setActiveTab] = useState<MainTabKey>(() => getInitialTuningTab(db))

  useEffect(() => {
    if (availableTabs.length === 0) return
    if (!availableTabs.includes(activeTab)) setActiveTab(availableTabs[0])
  }, [activeTab, availableTabs])

  return (
    <div className="text-white text-sans min-h-screen flex flex-col items-center">
      <div className="w-full max-w-[1200px] pt-1 flex flex-col gap-1">
        {systemDb && (
          <Card className="mb-2 bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4 flex flex-wrap items-end gap-x-6 gap-y-4 justify-center">
              <div className="flex items-end gap-12">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground font-medium">{uiText('Device')}</Label>
                  <div className="h-9 flex items-center">
                    <span className="text-sm font-semibold text-white tracking-wide">{state.db?.deviceId || '-'}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground font-medium">{uiText('Version')}</Label>
                  <div className="h-9 flex items-center">
                    <span className="text-sm font-semibold text-white tracking-wide">{state.db?.firmwareVersion || '-'}</span>
                  </div>
                </div>
              </div>

              <Separator orientation="vertical" className="hidden sm:block h-14 self-center mx-6 bg-zinc-700" />
              <Separator orientation="horizontal" className="sm:hidden w-full bg-zinc-800 my-2" />

              <div className="flex flex-wrap items-end gap-6 justify-center">
                <SystemVolumeSlider
                  label="Music Volume"
                  value={systemDb.musicVolume ?? undefined}
                  range={systemMusicVolumeRange}
                  disabled={systemDisabled}
                  uiText={uiText}
                  onChange={(value) => {
                    actions.queueSystem({ musicVolume: clampToRange(Math.round(value), systemMusicVolumeRange) })
                  }}
                />
                <SystemVolumeSlider
                  label="Mic Volume"
                  value={systemDb.micVolume ?? undefined}
                  range={systemMicVolumeRange}
                  disabled={systemDisabled}
                  uiText={uiText}
                  onChange={(value) => {
                    actions.queueSystem({ micVolume: clampToRange(Math.round(value), systemMicVolumeRange) })
                  }}
                />
                <SystemVolumeSlider
                  label="Effect Volume"
                  value={systemDb.effectVolume ?? undefined}
                  range={systemEffectVolumeRange}
                  disabled={systemDisabled}
                  uiText={uiText}
                  onChange={(value) => {
                    actions.queueSystem({ effectVolume: clampToRange(Math.round(value), systemEffectVolumeRange) })
                  }}
                />
                <div className="flex items-center h-[56px] pb-1">
                  <ToggleControl
                    label="Mute"
                    pressed={systemDb.mute ?? undefined}
                    disabled={systemDisabled}
                    onChange={(pressed) => actions.queueSystem({ mute: pressed })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const next = value as MainTabKey
            if (availableTabs.includes(next)) setActiveTab(next)
          }}
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:justify-center">
            {musicDb && <TabsTrigger value="music">{uiText('Music')}</TabsTrigger>}
            {micDb && <TabsTrigger value="mic">{uiText('Mic')}</TabsTrigger>}
            {reverbDb && <TabsTrigger value="reverb">{uiText('Reverb')}</TabsTrigger>}
            {echoDb && <TabsTrigger value="echo">{uiText('Echo')}</TabsTrigger>}
            {mainOutputDb && <TabsTrigger value="mainoutput">{uiText('Main Output')}</TabsTrigger>}
            {subOutputDb && <TabsTrigger value="suboutput">{uiText('Sub Output')}</TabsTrigger>}
            {centerDb && <TabsTrigger value="center">{uiText('Center')}</TabsTrigger>}
            {surroundDb && <TabsTrigger value="surround">{uiText('Surround')}</TabsTrigger>}
            {systemDb && <TabsTrigger value="system">{uiText('System')}</TabsTrigger>}
          </TabsList>

          {systemDb && (
            <TabsContent value="system">
              <SystemPanel
                ns={ns}
                uiText={uiText}
                systemDb={systemDb}
                systemRanges={systemRanges}
                disabled={systemDisabled}
                systemModeValue={systemModeValue}
                systemModeOptions={systemModeOptions}
                showDanceModeCard={showDanceModeCard}
                showSystemDefaultsCard={showSystemDefaultsCard}
                showSystemLimitsCard={showSystemLimitsCard}
                systemMusicDefaultVolumeRange={systemMusicDefaultVolumeRange}
                systemMicDefaultVolumeRange={systemMicDefaultVolumeRange}
                systemEffectDefaultVolumeRange={systemEffectDefaultVolumeRange}
                systemMusicMaxVolumeRange={systemMusicMaxVolumeRange}
                systemMicMaxVolumeRange={systemMicMaxVolumeRange}
                systemEffectMaxVolumeRange={systemEffectMaxVolumeRange}
                isBleRenameDialogOpen={isBleRenameDialogOpen}
                setIsBleRenameDialogOpen={setIsBleRenameDialogOpen}
                bleNameDraft={bleNameDraft}
                setBleNameDraft={setBleNameDraft}
                isModeRenameDialogOpen={isModeRenameDialogOpen}
                setIsModeRenameDialogOpen={setIsModeRenameDialogOpen}
                modeNamesDraft={modeNamesDraft}
                setModeNamesDraft={setModeNamesDraft}
                isSaveModeDialogOpen={isSaveModeDialogOpen}
                setIsSaveModeDialogOpen={setIsSaveModeDialogOpen}
                saveTargetModeIndex={saveTargetModeIndex}
                setSaveTargetModeIndex={setSaveTargetModeIndex}
                isExportDialogOpen={isExportDialogOpen}
                setIsExportDialogOpen={setIsExportDialogOpen}
                exportFilename={exportFilename}
                setExportFilename={setExportFilename}
                performExport={performExport}
                handleExport={handleExport}
                isImportConfirmOpen={isImportConfirmOpen}
                setIsImportConfirmOpen={setIsImportConfirmOpen}
                pendingImportData={pendingImportData}
                importValidation={importValidation}
                confirmPendingImport={confirmPendingImport}
                handleImport={handleImport}
                fileInputRef={fileInputRef}
                actions={actions}
              />
            </TabsContent>
          )}

          {musicDb && (
            <TabsContent value="music">
              <MusicPanel
                musicDb={musicDb}
                musicRanges={musicRanges}
                panelState={panelStateByKey.music}
                panelPower={getPanelPower('music')}
                disabled={musicDisabled}
                activeIndex={activeIndex}
                dragging={dragging}
                handleFilterChange={handleFilterChangeByKey.music}
                handlePointDoubleClick={handlePointDoubleClickByKey.music}
                handleMouseEnter={handleMouseEnter}
                handleMouseLeave={handleMouseLeave}
                setDragging={setDragging}
                queueMusic={actions.queueMusic}
                resetEq={actions.resetEq}
                queueEqBypass={actions.queueEqBypass}
              />
            </TabsContent>
          )}

          {micDb && (
            <TabsContent value="mic">
              <MicPanel
                micDb={micDb}
                deviceConfig={state.db}
                micRanges={micRanges}
                micKey={micKey}
                setMicKey={setMicKey}
                showMicSelector={showMicSelector}
                panelState={panelStateByKey[micKey]}
                panelPower={getPanelPower(micKey)}
                disabled={micDisabled}
                activeIndex={activeIndex}
                dragging={dragging}
                handleFilterChange={handleFilterChangeByKey[micKey]}
                handlePointDoubleClick={handlePointDoubleClickByKey[micKey]}
                handleMouseEnter={handleMouseEnter}
                handleMouseLeave={handleMouseLeave}
                setDragging={setDragging}
                queueMic={actions.queueMic}
                queueEqBypass={actions.queueEqBypass}
                queueEqPoint={actions.queueEqPoint}
                resetEq={actions.resetEq}
              />
            </TabsContent>
          )}

          {reverbDb && (
            <TabsContent value="reverb">
              <EffectPanel
                kind="reverb"
                effectDb={reverbDb}
                ranges={reverbRanges}
                panelState={panelStateByKey.reverb}
                panelPower={getPanelPower('reverb')}
                disabled={reverbDisabled}
                activeIndex={activeIndex}
                dragging={dragging}
                handleFilterChange={handleFilterChangeByKey.reverb}
                handlePointDoubleClick={handlePointDoubleClickByKey.reverb}
                handleMouseEnter={handleMouseEnter}
                handleMouseLeave={handleMouseLeave}
                setDragging={setDragging}
                queueEffect={actions.queueReverb}
                resetEq={actions.resetEq}
                queueEqBypass={actions.queueEqBypass}
              />
            </TabsContent>
          )}

          {echoDb && (
            <TabsContent value="echo">
              <EffectPanel
                kind="echo"
                effectDb={echoDb}
                ranges={echoRanges}
                panelState={panelStateByKey.echo}
                panelPower={getPanelPower('echo')}
                disabled={echoDisabled}
                activeIndex={activeIndex}
                dragging={dragging}
                handleFilterChange={handleFilterChangeByKey.echo}
                handlePointDoubleClick={handlePointDoubleClickByKey.echo}
                handleMouseEnter={handleMouseEnter}
                handleMouseLeave={handleMouseLeave}
                setDragging={setDragging}
                queueEffect={actions.queueEcho}
                resetEq={actions.resetEq}
                queueEqBypass={actions.queueEqBypass}
              />
            </TabsContent>
          )}

          {mainOutputDb && (
            <TabsContent value="mainoutput">
              <OutputPanel
                kind="mainoutput"
                outputDb={mainOutputDb}
                ranges={mainOutputRanges}
                mixer={mainOutputMixer}
                panelState={panelStateByKey.mainoutput}
                panelPower={getPanelPower('mainoutput')}
                headerExtra={outputModeControls}
                sceneMode={resolvedOutputSceneMode}
                disabled={mainOutputDisabled}
                eqDisabled={mainOutputEqDisabled}
                mixerDisabled={mainOutputMixerDisabled}
                target={webhmi.EqTarget.MAIN_OUTPUT}
                activeIndex={activeIndex}
                dragging={dragging}
                handleFilterChange={handleFilterChangeByKey.mainoutput}
                handlePointDoubleClick={handlePointDoubleClickByKey.mainoutput}
                handleMouseEnter={handleMouseEnter}
                handleMouseLeave={handleMouseLeave}
                setDragging={setDragging}
                queueOutput={actions.queueMainOutput}
                resetEq={actions.resetEq}
                queueEqBypass={actions.queueEqBypass}
              />
            </TabsContent>
          )}

          {subOutputDb && (
            <TabsContent value="suboutput">
              <OutputPanel
                kind="suboutput"
                outputDb={subOutputDb}
                ranges={subOutputRanges}
                mixer={subOutputMixer}
                panelState={panelStateByKey.suboutput}
                panelPower={getPanelPower('suboutput')}
                headerExtra={outputModeControls}
                sceneMode={resolvedOutputSceneMode}
                disabled={subOutputDisabled}
                eqDisabled={subOutputEqDisabled}
                mixerDisabled={subOutputMixerDisabled}
                target={webhmi.EqTarget.SUB_OUTPUT}
                activeIndex={activeIndex}
                dragging={dragging}
                handleFilterChange={handleFilterChangeByKey.suboutput}
                handlePointDoubleClick={handlePointDoubleClickByKey.suboutput}
                handleMouseEnter={handleMouseEnter}
                handleMouseLeave={handleMouseLeave}
                setDragging={setDragging}
                queueOutput={actions.queueSubOutput}
                resetEq={actions.resetEq}
                queueEqBypass={actions.queueEqBypass}
              />
            </TabsContent>
          )}

          {centerDb && (
            <TabsContent value="center">
              <OutputPanel
                kind="center"
                outputDb={centerDb}
                ranges={centerRanges}
                mixer={centerMixer}
                panelState={panelStateByKey.center}
                panelPower={getPanelPower('center')}
                headerExtra={outputModeControls}
                sceneMode={resolvedOutputSceneMode}
                disabled={centerDisabled}
                eqDisabled={centerEqDisabled}
                mixerDisabled={centerMixerDisabled}
                target={webhmi.EqTarget.CENTER}
                activeIndex={activeIndex}
                dragging={dragging}
                handleFilterChange={handleFilterChangeByKey.center}
                handlePointDoubleClick={handlePointDoubleClickByKey.center}
                handleMouseEnter={handleMouseEnter}
                handleMouseLeave={handleMouseLeave}
                setDragging={setDragging}
                queueOutput={actions.queueCenter}
                resetEq={actions.resetEq}
                queueEqBypass={actions.queueEqBypass}
              />
            </TabsContent>
          )}

          {surroundDb && (
            <TabsContent value="surround">
              <OutputPanel
                kind="surround"
                outputDb={surroundDb}
                ranges={surroundRanges}
                mixer={surroundMixer}
                panelState={panelStateByKey.surround}
                panelPower={getPanelPower('surround')}
                headerExtra={outputModeControls}
                sceneMode={resolvedOutputSceneMode}
                disabled={surroundDisabled}
                eqDisabled={surroundEqDisabled}
                mixerDisabled={surroundMixerDisabled}
                target={webhmi.EqTarget.SURROUND}
                activeIndex={activeIndex}
                dragging={dragging}
                handleFilterChange={handleFilterChangeByKey.surround}
                handlePointDoubleClick={handlePointDoubleClickByKey.surround}
                handleMouseEnter={handleMouseEnter}
                handleMouseLeave={handleMouseLeave}
                setDragging={setDragging}
                queueOutput={actions.queueSurround}
                resetEq={actions.resetEq}
                queueEqBypass={actions.queueEqBypass}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}

