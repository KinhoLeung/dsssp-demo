import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  uiTextKey,
  hasNumber,
  hasBoolean,
  hasAny,
  hasEnum,
  getEnumNumberValue,
  nearlyEqual,
  panelStateEqual,
  buildPanelStateFromEq,
  mapGraphTypeToFilterType,
  INPUT_SELECT_OPTIONS,
  FBX_OPTIONS,
  type PanelKey,
  type MainTabKey,
  type PanelDef,
  type PanelState,
  type SelectOption,
} from './dspUtils'
import {
  ParameterCard,
  NumberControl,
  ToggleControl,
  ToggleGroupControl,
  PhaseInversionToggle,
  CompressorGraph,
  DspPanel,
} from './index'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { buildParameterRanges, clampToRange, withRangeBounds } from '@/configs/parameterRanges'
import { webhmi } from '@/device/proto/generated/webhmi'
import { useTuningState } from '@/hooks/useTuningState'
import { cn } from '@/lib/utils'

// Shared DSP UI components

export type GenericTuningPageProps = {
  isDemoMode: boolean
}

const isOutputPanelKey = (key: PanelKey) => key === 'mainoutput' || key === 'suboutput' || key === 'center' || key === 'surround'

const getSceneModeFromConfig = (config: webhmi.IDeviceConfig | null): webhmi.OutputSceneMode => {
  const value = config?.db?.system?.sceneMode
  return typeof value === 'number' ? value as webhmi.OutputSceneMode : webhmi.OutputSceneMode.OUTPUT_SCENE_SING
}

const getOutputEqForScene = (output: any, sceneMode: webhmi.OutputSceneMode): webhmi.IEq | null =>
  sceneMode === webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE
    ? output?.danceEq ?? output?.singEq ?? null
    : output?.singEq ?? output?.danceEq ?? null

const getOutputMixerForScene = (output: any, sceneMode: webhmi.OutputSceneMode): webhmi.IMixer | null =>
  sceneMode === webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE
    ? output?.danceMixer ?? output?.singMixer ?? null
    : output?.singMixer ?? output?.danceMixer ?? null

const mixerPatchForScene = (sceneMode: webhmi.OutputSceneMode, patch: webhmi.IMixerPatch) =>
  sceneMode === webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE
    ? { danceMixer: patch }
    : { singMixer: patch }

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

  const cleanInternalFields = useCallback((obj: any): any => {
    if (Array.isArray(obj)) return obj.map(cleanInternalFields)
    if (obj !== null && typeof obj === 'object') {
      const out: any = {}
      for (const [k, v] of Object.entries(obj)) {
        if (!k.startsWith('_')) {
          out[k] = cleanInternalFields(v)
        }
      }
      return out
    }
    return obj
  }, [])

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportFilename, setExportFilename] = useState('')

  const performExport = useCallback(() => {
    if (!state.db) return
    const cleanDb = cleanInternalFields(state.db)

    // Exclude 'system' parameters from export as requested
    if (cleanDb.db) {
      delete (cleanDb.db as any).system
    }

    const buffer = webhmi.DeviceConfig.encode(cleanDb as webhmi.IDeviceConfig).finish()
    const blob = new Blob([buffer as any], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const finalName = exportFilename.trim() || `device_config_${new Date().toISOString().replace(/[:.]/g, '-')}`
    a.download = `${finalName}.webhmi`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setIsExportDialogOpen(false)
  }, [state.db, cleanInternalFields, exportFilename])

  const handleExport = useCallback(() => {
    const deviceId = state.db?.deviceId || 'device'
    const firmwareVersion = state.db?.firmwareVersion || 'v0'
    setExportFilename(`${deviceId}-${firmwareVersion}-`)
    setIsExportDialogOpen(true)
  }, [state.db])

  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
  const [pendingImportData, setPendingImportData] = useState<webhmi.IDeviceConfig | null>(null)
  const [importValidation, setImportValidation] = useState<{
    type: 'error' | 'warning'
    message: string
    title: string
  } | null>(null)

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const buffer = await file.arrayBuffer()
        const data = webhmi.DeviceConfig.decode(new Uint8Array(buffer))
        if (!data.db) {
          throw new Error(
            t(`${ns}.import.invalidConfigMissingDb`, {
              defaultValue: 'Invalid configuration file: missing database content.',
            }),
          )
        }

        const currentDeviceId = state.db?.deviceId
        const currentVersion = state.db?.firmwareVersion

        // 1. Check Device ID (Hard Error)
        if (data.deviceId && currentDeviceId && data.deviceId !== currentDeviceId) {
          setImportValidation({
            type: 'error',
            title: uiText('Device Mismatch'),
            message: t(`${ns}.import.deviceMismatch`, {
              deviceId: data.deviceId,
              currentDeviceId,
              defaultValue:
                'This configuration file is for "{{deviceId}}", but you are connected to "{{currentDeviceId}}". Importing is not allowed to prevent damage.',
            }),
          })
          setPendingImportData(null)
          setIsImportConfirmOpen(true)
          e.target.value = ''
          return
        }

        // 2. Check Firmware Version
        const getMajor = (v: string) => v.replace(/^v/i, '').split('.')[0]
        const importMajor = data.firmwareVersion ? getMajor(data.firmwareVersion) : null
        const currentMajor = currentVersion ? getMajor(currentVersion) : null

        // 2a. Major Version Mismatch (Hard Error)
        if (importMajor && currentMajor && importMajor !== currentMajor) {
          setImportValidation({
            type: 'error',
            title: uiText('Critical Version Mismatch'),
            message: t(`${ns}.import.criticalVersionMismatch`, {
              importMajor,
              currentMajor,
              defaultValue:
                'This configuration (Major v{{importMajor}}) is incompatible with your device (Major v{{currentMajor}}). To prevent damage, importing is not allowed.',
            }),
          })
          setPendingImportData(null)
          setIsImportConfirmOpen(true)
          e.target.value = ''
          return
        }

        // 2b. Minor/Patch Version Mismatch (Warning)
        if (data.firmwareVersion && currentVersion && data.firmwareVersion !== currentVersion) {
          setImportValidation({
            type: 'warning',
            title: uiText('Version Mismatch'),
            message: t(`${ns}.import.versionMismatch`, {
              firmwareVersion: data.firmwareVersion,
              currentVersion,
              defaultValue:
                'The configuration version ({{firmwareVersion}}) does not match the device version ({{currentVersion}}). Some parameters might behave unexpectedly. Do you want to continue?',
            }),
          })
          setPendingImportData(data)
          setIsImportConfirmOpen(true)
          e.target.value = ''
          return
        }

        // 3. Perfect match
        actions.applyImportData(data)
        e.target.value = ''
      } catch (err) {
        console.error('Import failed', err)
        alert(
          t(`${ns}.import.importFailed`, {
            error: err instanceof Error ? err.message : String(err),
            defaultValue: 'Import failed: {{error}}',
          }),
        )
        e.target.value = ''
      }
    },
    [actions, state.db, t, ns, uiText],
  )

  useEffect(() => {
    const shouldDisconnectOnCleanup = didMountOnceRef.current
    didMountOnceRef.current = true
    return () => {
      if (!shouldDisconnectOnCleanup) return
      void disconnect()
    }
  }, [disconnect])

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
  const baseDisabled = !db || state.authOk !== true
  const systemDb = db?.system ?? null
  const musicDb = db?.music ?? null
  const micDb = db?.mic ?? null
  const reverbDb = db?.reverb ?? null
  const echoDb = db?.echo ?? null
  const mainOutputDb = db?.mainOutput ?? null
  const subOutputDb = db?.subOutput ?? null
  const centerDb = db?.center ?? null
  const surroundDb = db?.surround ?? null
  const outputControlMode = getEnumNumberValue(systemDb?.controlMode, webhmi.OutputControlMode)
  const resolvedOutputControlMode = !Number.isNaN(outputControlMode)
    ? outputControlMode as webhmi.OutputControlMode
    : webhmi.OutputControlMode.OUTPUT_CONTROL_AUTO
  const outputSceneMode = getEnumNumberValue(systemDb?.sceneMode, webhmi.OutputSceneMode)
  const resolvedOutputSceneMode = !Number.isNaN(outputSceneMode)
    ? outputSceneMode as webhmi.OutputSceneMode
    : webhmi.OutputSceneMode.OUTPUT_SCENE_SING
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
  const musicInputSelectValue = useMemo(() => {
    const val = getEnumNumberValue(musicDb?.inputSelect, webhmi.InputSelect)
    return !Number.isNaN(val) ? String(val) : undefined
  }, [musicDb?.inputSelect])
  const musicInputSelectOptions = useMemo(() => {
    if (musicDb?.inputSelectList && musicDb.inputSelectList.length > 0) {
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
  }, [musicDb?.inputSelectList])
  const micFbxValue = useMemo(() => {
    const val = getEnumNumberValue(micDb?.micFBX, webhmi.FbxMode)
    return !Number.isNaN(val) ? String(val) : undefined
  }, [micDb?.micFBX])
  const micFbxOptions = useMemo(() => {
    if (micDb?.fbxModeList && micDb.fbxModeList.length > 0) {
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
  }, [micDb?.fbxModeList])
  const systemModeValue = useMemo(() => {
    const index = systemDb?.currentModeIndex
    if (typeof index !== 'number') return undefined
    const modes = systemDb?.modeList ?? []
    if (index < 0 || index >= modes.length) return undefined
    return String(index)
  }, [systemDb?.currentModeIndex, systemDb?.modeList])
  const musicDisabled = baseDisabled || !musicDb
  const micDisabled = baseDisabled || !micDb
  const reverbDisabled = baseDisabled || !reverbDb
  const echoDisabled = baseDisabled || !echoDb
  const outputAutoMode = resolvedOutputControlMode === webhmi.OutputControlMode.OUTPUT_CONTROL_AUTO
  const mainOutputDisabled = baseDisabled || !mainOutputDb
  const subOutputDisabled = baseDisabled || !subOutputDb
  const centerDisabled = baseDisabled || !centerDb
  const surroundDisabled = baseDisabled || !surroundDb
  const mainOutputEqDisabled = mainOutputDisabled || outputAutoMode
  const subOutputEqDisabled = subOutputDisabled || outputAutoMode
  const centerEqDisabled = centerDisabled || outputAutoMode
  const surroundEqDisabled = surroundDisabled || outputAutoMode
  const mainOutputMixerDisabled = mainOutputDisabled || outputAutoMode
  const subOutputMixerDisabled = subOutputDisabled || outputAutoMode
  const centerMixerDisabled = centerDisabled || outputAutoMode
  const surroundMixerDisabled = surroundDisabled || outputAutoMode
  const systemDisabled = baseDisabled || !systemDb

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

  const showMusicParamsCard =
    hasAny(
      musicDb?.inputGain,
      musicDb?.musicPitch,
      musicDb?.btGain,
      musicDb?.udiskGain,
      musicDb?.bass,
      musicDb?.mid,
      musicDb?.midFreq,
      musicDb?.treble,
    ) || hasEnum(musicDb?.inputSelect, webhmi.InputSelect)
  const showMusicNoiseCard = !!musicDb?.noise && hasAny(musicDb.noise.gate, musicDb.noise.frameTime, musicDb.noise.atkTime, musicDb.noise.relTime)

  const showMicParamsCard =
    hasAny(
      micDb?.micAVolume,
      micDb?.micBVolume,
      micDb?.micEqJointDebugging,
      micDb?.bass,
      micDb?.mid,
      micDb?.midFreq,
      micDb?.treble,
    ) || hasEnum(micDb?.micFBX, webhmi.FbxMode)
  const showMicNoiseCard = !!micDb?.noise && hasAny(micDb.noise.gate, micDb.noise.frameTime, micDb.noise.atkTime, micDb.noise.relTime)
  const showMicCompressorCard = !!micDb?.compressor && hasAny(
    micDb.compressor.threshold,
    micDb.compressor.ratio,
    micDb.compressor.attack,
    micDb.compressor.release,
    micDb.compressor.bypass,
  )

  const showReverbCard = hasAny(reverbDb?.reverbLevel, reverbDb?.micDirectLevel, reverbDb?.reverbPredelay, reverbDb?.reverbDecay)
  const showEchoCard = hasAny(
    echoDb?.echoLevel,
    echoDb?.micDirectLevel,
    echoDb?.echoPredelay,
    echoDb?.echoDelayTime,
    echoDb?.echoRepeat,
    echoDb?.echoRightPredelay,
    echoDb?.echoRightDelay,
  )

  const showMainOutputOutputCard =
    !!mainOutputDb?.output &&
    hasAny(
      mainOutputDb.output.leftChannelVolume,
      mainOutputDb.output.rightChannelVolume,
      mainOutputDb.output.leftDelay,
      mainOutputDb.output.rightDelay,
      mainOutputDb.output.leftMute,
      mainOutputDb.output.rightMute,
    )
  const showMainOutputMixerCard =
    !!mainOutputMixer &&
    hasAny(
      mainOutputMixer.micDirectLevel,
      mainOutputMixer.musicLevel,
      mainOutputMixer.reverbLevel,
      mainOutputMixer.echoLevel,
    )
  const showMainOutputCompressorCard =
    !!mainOutputDb?.compressor &&
    hasAny(
      mainOutputDb.compressor.threshold,
      mainOutputDb.compressor.ratio,
      mainOutputDb.compressor.attack,
      mainOutputDb.compressor.release,
      mainOutputDb.compressor.bypass,
    )

  const showSubOutputOutputCard =
    !!subOutputDb?.output && hasAny(subOutputDb.output.volume, subOutputDb.output.delay, subOutputDb.output.mute)
  const showSubOutputMixerCard =
    !!subOutputMixer &&
    hasAny(subOutputMixer.micDirectLevel, subOutputMixer.musicLevel, subOutputMixer.reverbLevel, subOutputMixer.echoLevel)
  const showSubOutputCompressorCard =
    !!subOutputDb?.compressor &&
    hasAny(
      subOutputDb.compressor.threshold,
      subOutputDb.compressor.ratio,
      subOutputDb.compressor.attack,
      subOutputDb.compressor.release,
      subOutputDb.compressor.bypass,
    )

  const showCenterOutputCard = !!centerDb?.output && hasAny(centerDb.output.volume, centerDb.output.delay, centerDb.output.mute)
  const showCenterMixerCard =
    !!centerMixer && hasAny(centerMixer.micDirectLevel, centerMixer.musicLevel, centerMixer.reverbLevel, centerMixer.echoLevel)
  const showCenterCompressorCard =
    !!centerDb?.compressor &&
    hasAny(
      centerDb.compressor.threshold,
      centerDb.compressor.ratio,
      centerDb.compressor.attack,
      centerDb.compressor.release,
      centerDb.compressor.bypass,
    )

  const showSurroundOutputCard =
    !!surroundDb?.output &&
    hasAny(
      surroundDb.output.leftChannelVolume,
      surroundDb.output.rightChannelVolume,
      surroundDb.output.leftDelay,
      surroundDb.output.rightDelay,
      surroundDb.output.leftMute,
      surroundDb.output.rightMute,
    )
  const showSurroundMixerCard =
    !!surroundMixer &&
    hasAny(surroundMixer.micDirectLevel, surroundMixer.musicLevel, surroundMixer.reverbLevel, surroundMixer.echoLevel)
  const showSurroundCompressorCard =
    !!surroundDb?.compressor &&
    hasAny(
      surroundDb.compressor.threshold,
      surroundDb.compressor.ratio,
      surroundDb.compressor.attack,
      surroundDb.compressor.release,
      surroundDb.compressor.bypass,
    )

  const [dragging, setDraggingState] = useState(false)
  const isDraggingRef = useRef(false)
  const setDragging = useCallback((d: boolean) => {
    isDraggingRef.current = d
    setDraggingState(d)
  }, [])

  const [activeIndex, setActiveIndexState] = useState<number>(0)
  const activeIndexRef = useRef(0)
  const setActiveIndex = useCallback((i: number) => {
    if (activeIndexRef.current === i) return
    activeIndexRef.current = i
    setActiveIndexState(i)
  }, [])
  const [panelStateByKey, setPanelStateByKey] = useState<Record<PanelKey, PanelState>>(() => {
    const out = {} as Record<PanelKey, PanelState>
    for (const panel of panels) out[panel.key] = { filters: [], pointIndexByUiIndex: [], allowedTypesByUiIndex: [] }
    return out
  })

  const panelStateByKeyRef = useRef(panelStateByKey)
  useEffect(() => {
    panelStateByKeyRef.current = panelStateByKey
  }, [panelStateByKey])

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const actionsRef = useRef(actions)
  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    if (isDraggingRef.current) return

    const out = {} as Record<PanelKey, PanelState>
    for (const panel of panels) {
      const eq = panel.getEq(state.db)
      out[panel.key] = buildPanelStateFromEq(eq)
    }
    setPanelStateByKey((prev) => {
      let changed = false
      const next = { ...prev }
      for (const panel of panels) {
        const key = panel.key
        const desired = out[key]
        const existing = prev[key]
        if (!existing || !panelStateEqual(existing, desired)) {
          next[key] = desired
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [panels, state.dbFetchId])

  const handleMouseLeave = () => {
    if (!isDraggingRef.current) setActiveIndex(-1)
  }

  const handleMouseEnter = ({ index }: { index: number }) => {
    if (!isDraggingRef.current) setActiveIndex(index)
  }

  const uiRafIdRef = useRef<number | null>(null)
  const pendingUiPatchesRef = useRef<Map<PanelKey, Map<number, Partial<any>>>>(new Map())

  const graphFilterEqual = (a: any, b: any) =>
    a.type === b.type && nearlyEqual(a.freq, b.freq) && nearlyEqual(a.gain, b.gain) && nearlyEqual(a.q, b.q)

  const applyUiPatches = useCallback((patchesByKey: Map<PanelKey, Map<number, Partial<any>>>) => {
    if (patchesByKey.size === 0) return
    setPanelStateByKey((prev) => {
      let changed = false
      const next = { ...prev }

      for (const [key, patchesByIndex] of patchesByKey.entries()) {
        if (patchesByIndex.size === 0) continue
        let keyChanged = false
        const current = next[key] ?? { filters: [], pointIndexByUiIndex: [] }
        const nextFilters = [...current.filters]

        for (const [uiIndex, patch] of patchesByIndex.entries()) {
          const existing = nextFilters[uiIndex]
          if (!existing) {
            nextFilters[uiIndex] = patch as any
            keyChanged = true
            continue
          }
          const merged = { ...existing, ...patch }
          if (!graphFilterEqual(existing, merged)) {
            nextFilters[uiIndex] = merged
            keyChanged = true
          }
        }

        if (keyChanged) {
          next[key] = { ...current, filters: nextFilters }
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [])

  const scheduleUiFlush = useCallback(() => {
    if (uiRafIdRef.current != null) return
    uiRafIdRef.current = window.requestAnimationFrame(() => {
      uiRafIdRef.current = null
      const pending = pendingUiPatchesRef.current
      pendingUiPatchesRef.current = new Map()
      applyUiPatches(pending)
    })
  }, [applyUiPatches])

  useEffect(() => {
    return () => {
      if (uiRafIdRef.current != null) window.cancelAnimationFrame(uiRafIdRef.current)
    }
  }, [])

  const handleFilterChangeForKey = useCallback(
    (key: PanelKey, filterEvent: any) => {
      const def = panelByKey[key]
      const stateForPanel = panelStateByKeyRef.current[key]
      if (!def || !stateForPanel) return

      const { index: uiIndex, ended, ...filter } = filterEvent

      // Ensure active state and dragging state are maintained during any interaction
      if (!ended) {
        setActiveIndex(uiIndex)
        setDragging(true)
      } else {
        setDragging(false)
      }

      const jointDebug = stateRef.current.db?.db?.mic?.micEqJointDebugging
      const otherKey = (jointDebug && (key === 'mica' || key === 'micb')) ? (key === 'mica' ? 'micb' : 'mica') : null

      if (ended) {
        const pendingForKey = pendingUiPatchesRef.current.get(key)
        if (pendingForKey) {
          pendingForKey.delete(uiIndex)
          if (pendingForKey.size === 0) pendingUiPatchesRef.current.delete(key)
        }

        if (otherKey) {
          const pendingForOther = pendingUiPatchesRef.current.get(otherKey)
          if (pendingForOther) {
            pendingForOther.delete(uiIndex)
            if (pendingForOther.size === 0) pendingUiPatchesRef.current.delete(otherKey)
          }
        }

        const patches = new Map<PanelKey, Map<number, Partial<any>>>()
        patches.set(key, new Map([[uiIndex, filter]]))
        if (otherKey) patches.set(otherKey, new Map([[uiIndex, filter]]))

        applyUiPatches(patches)
      } else {
        const byIndex = pendingUiPatchesRef.current.get(key) ?? new Map<number, Partial<any>>()
        byIndex.set(uiIndex, filter)
        pendingUiPatchesRef.current.set(key, byIndex)

        if (otherKey) {
          const byIndexOther = pendingUiPatchesRef.current.get(otherKey) ?? new Map<number, Partial<any>>()
          byIndexOther.set(uiIndex, filter)
          pendingUiPatchesRef.current.set(otherKey, byIndexOther)
        }

        scheduleUiFlush()
      }

      const deviceIndex = stateForPanel.pointIndexByUiIndex[uiIndex] ?? uiIndex
      const filterType = mapGraphTypeToFilterType(filter.type)
      const gain = filter.type === 'BYPASS' ? 0 : filter.gain
      const q = filter.type === 'BYPASS' ? 1 : filter.q
      const freq = Math.max(1, Math.round(filter.freq))

      // Optimization: Only queue if the rounded values have actually changed in our local DB view
      const sourceDb = stateRef.current.db
      if (sourceDb) {
        const currentEq = def.getEq(sourceDb)
        if (currentEq?.point) {
          const cp = currentEq.point.find((p) => p && p.index === deviceIndex)
          if (cp && cp.type === filterType && nearlyEqual(cp.freq ?? 0, freq) && nearlyEqual(cp.gain ?? 0, gain) && nearlyEqual(cp.q ?? 0, q)) {
            return
          }
        }
      }

      const pointPatch = {
        index: deviceIndex,
        type: filterType,
        freq,
        gain,
        q,
      }
      const sceneMode = isOutputPanelKey(key) ? getSceneModeFromConfig(stateRef.current.db) : undefined
      actionsRef.current.queueEqPoint(def.target, pointPatch, sceneMode)

      // Sync changes if Mic Joint Debugging is enabled
      if (jointDebug && otherKey) {
        const otherPanel = panelByKey[otherKey]
        if (otherPanel) {
          actionsRef.current.queueEqPoint(otherPanel.target, pointPatch)
        }
      }
    },
    [applyUiPatches, panelByKey, scheduleUiFlush, setActiveIndex, setDragging],
  )

  const handlePointDoubleClickForKey = useCallback(
    (key: PanelKey, filterEvent: any) => {
      const def = panelByKey[key]
      const stateForPanel = panelStateByKeyRef.current[key]
      if (!def || !stateForPanel) return

      const uiIndex = filterEvent.index
      const deviceIndex = stateForPanel.pointIndexByUiIndex[uiIndex] ?? uiIndex
      const sceneMode = isOutputPanelKey(key) ? getSceneModeFromConfig(stateRef.current.db) : undefined
      void actionsRef.current.resetEqPointToDefault(def.target, deviceIndex, sceneMode)

      // Sync changes if Mic Joint Debugging is enabled
      const jointDebug = stateForPanel.pointIndexByUiIndex.length > 0 && stateRef.current.db?.db?.mic?.micEqJointDebugging
      if (jointDebug && (key === 'mica' || key === 'micb')) {
        const otherKey = key === 'mica' ? 'micb' : 'mica'
        const otherPanel = panelByKey[otherKey]
        if (otherPanel) {
          void actionsRef.current.resetEqPointToDefault(otherPanel.target, deviceIndex)
        }
      }
    },
    [panelByKey],
  )

  const handleFilterChangeByKey = useMemo(
    () =>
      ({
        music: (e: any) => handleFilterChangeForKey('music', e),
        mica: (e: any) => handleFilterChangeForKey('mica', e),
        micb: (e: any) => handleFilterChangeForKey('micb', e),
        reverb: (e: any) => handleFilterChangeForKey('reverb', e),
        echo: (e: any) => handleFilterChangeForKey('echo', e),
        mainoutput: (e: any) => handleFilterChangeForKey('mainoutput', e),
        suboutput: (e: any) => handleFilterChangeForKey('suboutput', e),
        center: (e: any) => handleFilterChangeForKey('center', e),
        surround: (e: any) => handleFilterChangeForKey('surround', e),
      }) satisfies Record<PanelKey, (e: any) => void>,
    [handleFilterChangeForKey],
  )

  const handlePointDoubleClickByKey = useMemo(
    () =>
      ({
        music: (e: any) => handlePointDoubleClickForKey('music', e),
        mica: (e: any) => handlePointDoubleClickForKey('mica', e),
        micb: (e: any) => handlePointDoubleClickForKey('micb', e),
        reverb: (e: any) => handlePointDoubleClickForKey('reverb', e),
        echo: (e: any) => handlePointDoubleClickForKey('echo', e),
        mainoutput: (e: any) => handlePointDoubleClickForKey('mainoutput', e),
        suboutput: (e: any) => handlePointDoubleClickForKey('suboutput', e),
        center: (e: any) => handlePointDoubleClickForKey('center', e),
        surround: (e: any) => handlePointDoubleClickForKey('surround', e),
      }) satisfies Record<PanelKey, (e: any) => void>,
    [handlePointDoubleClickForKey],
  )

  const getPanelPower = (key: PanelKey) => {
    const eq = panelByKey[key]?.getEq(state.db)
    if (!eq) return { powered: false, bypass: false }
    const bypass = !!eq.bypass
    return { powered: !bypass, bypass }
  }

  type MicPanelKey = 'mica' | 'micb'
  const [micKey, setMicKey] = useState<MicPanelKey>('mica')
  const hasMicA = !!panelByKey.mica?.getEq(state.db)
  const hasMicB = !!panelByKey.micb?.getEq(state.db)
  const showMicSelector = hasMicA && hasMicB

  useEffect(() => {
    const desired: MicPanelKey = hasMicA ? 'mica' : hasMicB ? 'micb' : 'mica'
    if ((micKey === 'mica' && !hasMicA && hasMicB) || (micKey === 'micb' && !hasMicB && hasMicA)) {
      setMicKey(desired)
    }
    if (!hasMicA && !hasMicB && micKey !== 'mica') setMicKey('mica')
  }, [hasMicA, hasMicB, micKey])

  const availableTabs = useMemo<MainTabKey[]>(() => {
    const out: MainTabKey[] = []
    if (musicDb) out.push('music')
    if (micDb) out.push('mic')
    if (reverbDb) out.push('reverb')
    if (echoDb) out.push('echo')
    if (mainOutputDb) out.push('mainoutput')
    if (subOutputDb) out.push('suboutput')
    if (centerDb) out.push('center')
    if (surroundDb) out.push('surround')
    if (systemDb) out.push('system')
    return out
  }, [centerDb, echoDb, mainOutputDb, micDb, musicDb, reverbDb, subOutputDb, surroundDb, systemDb])

  const [activeTab, setActiveTab] = useState<MainTabKey>(() => {
    if (musicDb) return 'music'
    if (micDb) return 'mic'
    if (reverbDb) return 'reverb'
    if (echoDb) return 'echo'
    if (mainOutputDb) return 'mainoutput'
    if (subOutputDb) return 'suboutput'
    if (centerDb) return 'center'
    if (surroundDb) return 'surround'
    if (systemDb) return 'system'
    return 'music'
  })

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
                <NumberControl
                  label="Music Volume"
                  value={systemDb.musicVolume ?? undefined}
                  {...systemMusicVolumeRange}
                  disabled={systemDisabled}
                  className="w-32"
                  onChange={(value) => {
                    actions.queueSystem({ musicVolume: clampToRange(Math.round(value), systemMusicVolumeRange) })
                  }}
                />
                <NumberControl
                  label="Mic Volume"
                  value={systemDb.micVolume ?? undefined}
                  {...systemMicVolumeRange}
                  disabled={systemDisabled}
                  className="w-32"
                  onChange={(value) => {
                    actions.queueSystem({ micVolume: clampToRange(Math.round(value), systemMicVolumeRange) })
                  }}
                />
                <NumberControl
                  label="Effect Volume"
                  value={systemDb.effectVolume ?? undefined}
                  {...systemEffectVolumeRange}
                  disabled={systemDisabled}
                  className="w-32"
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
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <ParameterCard contentClassName="sm:grid-cols-2">
                    <div className="grid gap-1 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">{uiText('BLE Name')}</Label>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">{systemDb.bleName || '-'}</Label>
                        <Button
                          variant="outline"
                          disabled={systemDisabled}
                          onClick={() => {
                            setBleNameDraft(systemDb.bleName || '')
                            setIsBleRenameDialogOpen(true)
                          }}
                        >
                          {uiText('Rename')}
                        </Button>
                      </div>
                    </div>

                    <ToggleControl
                      label="Panel Lock"
                      pressed={systemDb.panelLock ?? undefined}
                      disabled={systemDisabled}
                      onChange={(pressed) => actions.queueSystem({ panelLock: pressed })}
                    />
                  </ParameterCard>

                  <Dialog open={isBleRenameDialogOpen} onOpenChange={setIsBleRenameDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>{uiText('Rename Bluetooth Device')}</DialogTitle>
                        <DialogDescription>
                          {uiText('Enter a new name for the BLE device.')}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="ble-name">{uiText('New BLE Name')}</Label>
                          <Input
                            id="ble-name"
                            value={bleNameDraft}
                            maxLength={64}
                            onChange={(e) => {
                              const val = e.target.value
                              if (new TextEncoder().encode(val).length <= 64) {
                                setBleNameDraft(val)
                              }
                            }}
                            placeholder={uiText('Enter BLE name')}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return
                              e.preventDefault()
                              const next = bleNameDraft.trim()
                              if (systemDisabled || !next || next === (systemDb.bleName ?? '')) return
                              actions.queueSystem({ bleName: next })
                              void actions.flushNow()
                              setIsBleRenameDialogOpen(false)
                            }}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBleRenameDialogOpen(false)}>
                          {uiText('Cancel')}
                        </Button>
                        <Button
                          disabled={
                            systemDisabled || !bleNameDraft.trim() || bleNameDraft.trim() === (systemDb.bleName ?? '')
                          }
                          onClick={() => {
                            const next = bleNameDraft.trim()
                            if (!next) return
                            actions.queueSystem({ bleName: next })
                            void actions.flushNow()
                            setIsBleRenameDialogOpen(false)
                          }}
                        >
                          {uiText('Modify')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>{uiText('Export Configuration')}</DialogTitle>
                        <DialogDescription>
                          {uiText('Specify a name for your configuration file.')}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="filename">{uiText('File Name')}</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="filename"
                              value={exportFilename}
                              onChange={(e) => setExportFilename(e.target.value)}
                              placeholder={uiText('Enter filename')}
                              className="flex-1"
                            />
                            <span className="text-sm text-muted-foreground">.webhmi</span>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                          {uiText('Cancel')}
                        </Button>
                        <Button onClick={performExport}>{uiText('Export')}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <ParameterCard title="Mode" contentClassName="sm:grid-cols-2">
                    {systemModeOptions.length > 0 && (
                      <>
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-0.5">
                            {uiText('Current Mode')}
                          </Label>
                          <Select
                            value={systemModeValue}
                            onValueChange={(value) => void actions.switchCurrentMode(Number(value))}
                            disabled={systemDisabled}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={uiText('Select mode')} />
                            </SelectTrigger>
                            <SelectContent>
                              {systemModeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-1 sm:col-span-2">
                          <Button
                            variant="outline"
                            className="text-xs h-9"
                            disabled={systemDisabled || !systemDb?.modeList?.length}
                            onClick={() => {
                              if (typeof systemDb?.currentModeIndex === 'number') setSaveTargetModeIndex(systemDb.currentModeIndex)
                              setIsSaveModeDialogOpen(true)
                            }}
                          >
                            {uiText('Save')}
                          </Button>
                          <Button
                            variant="outline"
                            className="text-xs h-9"
                            disabled={systemDisabled || !systemDb?.modeList?.length}
                            onClick={() => {
                              setModeNamesDraft(systemDb?.modeList ?? [])
                              setIsModeRenameDialogOpen(true)
                            }}
                          >
                            {uiText('Rename')}
                          </Button>
                        </div>
                      </>
                    )}

                    <Dialog open={isSaveModeDialogOpen} onOpenChange={setIsSaveModeDialogOpen}>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>{uiText('Save Current to Mode')}</DialogTitle>
                          <DialogDescription>
                            {uiText(
                              'This will overwrite the selected mode with your current parameters. This action cannot be undone.',
                            )}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label>{uiText('Target Mode')}</Label>
                            <Select
                              value={String(saveTargetModeIndex)}
                              onValueChange={(v) => setSaveTargetModeIndex(Number(v))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={uiText('Select mode')} />
                              </SelectTrigger>
                              <SelectContent>
                                {systemModeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsSaveModeDialogOpen(false)}>
                            {uiText('Cancel')}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={async () => {
                              await actions.saveMode(saveTargetModeIndex)
                              setIsSaveModeDialogOpen(false)
                            }}
                          >
                            {uiText('Confirm Save')}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isModeRenameDialogOpen} onOpenChange={setIsModeRenameDialogOpen}>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>{uiText('Rename Modes')}</DialogTitle>
                          <DialogDescription>
                            {uiText('Enter new names for all available modes.')}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                          {modeNamesDraft.map((name, index) => (
                            <div key={index} className="grid gap-2">
                              <Label htmlFor={`mode-name-${index}`}>
                                {uiText('Mode')} {index + 1}
                              </Label>
                              <Input
                                id={`mode-name-${index}`}
                                value={name}
                                maxLength={64}
                                onChange={(e) => {
                                  const val = e.target.value
                                  if (new TextEncoder().encode(val).length <= 64) {
                                    const next = [...modeNamesDraft]
                                    next[index] = val
                                    setModeNamesDraft(next)
                                  }
                                }}
                                placeholder={t(`${ns}.mode.enterName`, {
                                  index: index + 1,
                                  defaultValue: 'Enter mode {{index}} name',
                                })}
                              />
                            </div>
                          ))}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsModeRenameDialogOpen(false)}>
                            {uiText('Cancel')}
                          </Button>
                          <Button
                            disabled={
                              systemDisabled ||
                              modeNamesDraft.some(n => !n.trim()) ||
                              JSON.stringify(modeNamesDraft.map(n => n.trim())) === JSON.stringify(systemDb?.modeList ?? [])
                            }
                            onClick={() => {
                              const nextModes = modeNamesDraft.map(n => n.trim())
                              actions.queueSystem({ modeList: nextModes })
                              void actions.flushNow()
                              setIsModeRenameDialogOpen(false)
                            }}
                          >
                            {uiText('Save Changes')}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle className={cn(importValidation?.type === 'error' ? 'text-destructive' : 'text-warning')}>
                            {importValidation?.title}
                          </DialogTitle>
                          <DialogDescription>
                            {importValidation?.message}
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          {importValidation?.type === 'error' ? (
                            <Button onClick={() => setIsImportConfirmOpen(false)}>{uiText('Close')}</Button>
                          ) : (
                            <>
                              <Button variant="outline" onClick={() => setIsImportConfirmOpen(false)}>
                                {uiText('Cancel')}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  if (pendingImportData) {
                                    actions.applyImportData(pendingImportData)
                                    setIsImportConfirmOpen(false)
                                    setPendingImportData(null)
                                  }
                                }}
                              >
                                {uiText('Import Anyway')}
                              </Button>
                            </>
                          )}
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Separator className="sm:col-span-2 my-2" />
                    <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={systemDisabled}
                      >
                        {uiText('Import')}
                      </Button>
                      <Button variant="outline" onClick={handleExport} disabled={systemDisabled}>
                        {uiText('Export')}
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".webhmi"
                        onChange={handleImport}
                      />
                    </div>
                  </ParameterCard>

                  <ParameterCard title="Defaults" contentClassName="sm:grid-cols-2">
                    <ToggleControl
                      label="Use Default Volume"
                      pressed={systemDb.useDefaultVolume ?? undefined}
                      disabled={systemDisabled}
                      onChange={(pressed) => actions.queueSystem({ useDefaultVolume: pressed })}
                    />
                    <NumberControl
                      label="Music Default"
                      value={systemDb.musicDefaultVolume ?? undefined}
                      {...systemMusicDefaultVolumeRange}
                      disabled={systemDisabled}
                      onChange={(value) => {
                        actions.queueSystem({ musicDefaultVolume: clampToRange(Math.round(value), systemMusicDefaultVolumeRange) })
                      }}
                    />
                    <NumberControl
                      label="Mic Default"
                      value={systemDb.micDefaultVolume ?? undefined}
                      {...systemMicDefaultVolumeRange}
                      disabled={systemDisabled}
                      onChange={(value) => {
                        actions.queueSystem({ micDefaultVolume: clampToRange(Math.round(value), systemMicDefaultVolumeRange) })
                      }}
                    />
                    <NumberControl
                      label="Effect Default"
                      value={systemDb.effectDefaultVolume ?? undefined}
                      {...systemEffectDefaultVolumeRange}
                      disabled={systemDisabled}
                      onChange={(value) => {
                        actions.queueSystem({ effectDefaultVolume: clampToRange(Math.round(value), systemEffectDefaultVolumeRange) })
                      }}
                    />
                  </ParameterCard>

                  <ParameterCard title="Limits" contentClassName="sm:grid-cols-2">
                    <NumberControl
                      label="Music Max"
                      value={systemDb.musicMaxVolume ?? undefined}
                      {...systemMusicMaxVolumeRange}
                      disabled={systemDisabled}
                      onChange={(value) => {
                        const rounded = clampToRange(Math.round(value), systemMusicMaxVolumeRange)
                        const def = systemDb?.musicDefaultVolume ?? 0
                        const cur = systemDb?.musicVolume ?? 0
                        const validMax = Math.max(rounded, def)
                        const updates: any = { musicMaxVolume: validMax }
                        if (validMax < cur) {
                          updates.musicVolume = validMax
                        }
                        actions.queueSystem(updates)
                      }}
                    />
                    <NumberControl
                      label="Mic Max"
                      value={systemDb.micMaxVolume ?? undefined}
                      {...systemMicMaxVolumeRange}
                      disabled={systemDisabled}
                      onChange={(value) => {
                        const rounded = clampToRange(Math.round(value), systemMicMaxVolumeRange)
                        const def = systemDb?.micDefaultVolume ?? 0
                        const cur = systemDb?.micVolume ?? 0
                        const validMax = Math.max(rounded, def)
                        const updates: any = { micMaxVolume: validMax }
                        if (validMax < cur) {
                          updates.micVolume = validMax
                        }
                        actions.queueSystem(updates)
                      }}
                    />
                    <NumberControl
                      label="Effect Max"
                      value={systemDb.effectMaxVolume ?? undefined}
                      {...systemEffectMaxVolumeRange}
                      disabled={systemDisabled}
                      onChange={(value) => {
                        const rounded = clampToRange(Math.round(value), systemEffectMaxVolumeRange)
                        const def = systemDb?.effectDefaultVolume ?? 0
                        const cur = systemDb?.effectVolume ?? 0
                        const validMax = Math.max(rounded, def)
                        const updates: any = { effectMaxVolume: validMax }
                        if (validMax < cur) {
                          updates.effectVolume = validMax
                        }
                        actions.queueSystem(updates)
                      }}
                    />
                  </ParameterCard>
                </div>
              </div>
            </TabsContent>
          )}

          {musicDb && (
            <TabsContent value="music">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('music')}
                  eqRange={musicRanges.eq}
                  filters={panelStateByKey.music.filters}
                  allowedTypesByUiIndex={panelStateByKey.music.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.music.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  handleFilterChange={handleFilterChangeByKey.music}
                  handlePointDoubleClick={handlePointDoubleClickByKey.music}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.MUSIC)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.MUSIC, pressed)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showMusicParamsCard && (
                    <ParameterCard className="md:col-span-2" contentClassName="sm:grid-cols-2 md:grid-cols-4">
                      {hasNumber(musicDb?.inputGain) && (
                        <NumberControl
                          label="Input Gain"
                          value={musicDb?.inputGain ?? undefined}
                          {...musicRanges.inputGain}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ inputGain: Math.round(value) })}
                        />
                      )}
                      {hasNumber(musicDb?.musicPitch) && (
                        <NumberControl
                          label="Music Pitch"
                          value={musicDb?.musicPitch ?? undefined}
                          {...musicRanges.musicPitch}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ musicPitch: value })}
                        />
                      )}
                      {hasNumber(musicDb?.btGain) && (
                        <NumberControl
                          label="BT Gain"
                          value={musicDb?.btGain ?? undefined}
                          {...musicRanges.btGain}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ btGain: Math.round(value) })}
                        />
                      )}
                      {hasNumber(musicDb?.udiskGain) && (
                        <NumberControl
                          label="UDisk Gain"
                          value={musicDb?.udiskGain ?? undefined}
                          {...musicRanges.udiskGain}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ udiskGain: Math.round(value) })}
                        />
                      )}
                      {hasEnum(musicDb?.inputSelect, webhmi.InputSelect) && (
                        <div className="sm:col-span-2 md:col-span-4">
                          <ToggleGroupControl
                            label="Input Select"
                            value={musicInputSelectValue}
                            options={musicInputSelectOptions}
                            disabled={musicDisabled}
                            onChange={(value) => {
                              const parsed = Number(value)
                              if (!Number.isNaN(parsed)) actions.queueMusic({ inputSelect: parsed as webhmi.InputSelect })
                            }}
                          />
                        </div>
                      )}
                      {hasNumber(musicDb?.bass) && (
                        <NumberControl
                          label="Bass"
                          value={musicDb?.bass ?? undefined}
                          {...musicRanges.bass}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ bass: value })}
                        />
                      )}
                      {hasNumber(musicDb?.mid) && (
                        <NumberControl
                          label="Mid"
                          value={musicDb?.mid ?? undefined}
                          {...musicRanges.mid}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ mid: value })}
                        />
                      )}
                      {hasNumber(musicDb?.midFreq) && (
                        <NumberControl
                          label="Mid Freq (Hz)"
                          value={musicDb?.midFreq ?? undefined}
                          {...musicRanges.midFreq}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ midFreq: Math.round(value) })}
                        />
                      )}
                      {hasNumber(musicDb?.treble) && (
                        <NumberControl
                          label="Treble"
                          value={musicDb?.treble ?? undefined}
                          {...musicRanges.treble}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ treble: value })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showMusicNoiseCard && (
                    <ParameterCard title="Noise Gate" contentClassName="sm:grid-cols-2">
                      {hasNumber(musicDb?.noise?.gate) && (
                        <NumberControl
                          label="Gate"
                          value={musicDb?.noise?.gate ?? undefined}
                          {...musicRanges.noise.gate}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ noise: { gate: value } })}
                        />
                      )}
                      {hasNumber(musicDb?.noise?.frameTime) && (
                        <NumberControl
                          label="Frame Time"
                          value={musicDb?.noise?.frameTime ?? undefined}
                          {...musicRanges.noise.frameTime}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ noise: { frameTime: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(musicDb?.noise?.atkTime) && (
                        <NumberControl
                          label="Attack Time"
                          value={musicDb?.noise?.atkTime ?? undefined}
                          {...musicRanges.noise.atkTime}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ noise: { atkTime: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(musicDb?.noise?.relTime) && (
                        <NumberControl
                          label="Release Time"
                          value={musicDb?.noise?.relTime ?? undefined}
                          {...musicRanges.noise.relTime}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ noise: { relTime: Math.round(value) } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {micDb && (
            <TabsContent value="mic">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower(micKey)}
                  eqRange={micKey === 'mica' ? micRanges.micAEq.eq : micRanges.micBEq.eq}
                  filters={panelStateByKey[micKey].filters}
                  allowedTypesByUiIndex={panelStateByKey[micKey].allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey[micKey].pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  headerExtra={
                    showMicSelector || hasBoolean(micDb?.micEqJointDebugging) ? (
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
                        {showMicSelector && hasBoolean(micDb?.micEqJointDebugging) && (
                          <Toggle
                            variant="outline"
                            pressed={!!micDb?.micEqJointDebugging}
                            onPressedChange={(pressed) => {
                              if (pressed) {
                                const sourceKey = micKey
                                const targetKey = micKey === 'mica' ? 'micb' : 'mica'
                                const sourcePanel = panelByKey[sourceKey]
                                const targetPanel = panelByKey[targetKey]
                                const sourceEq = sourcePanel?.getEq(state.db)

                                if (sourceEq && targetPanel) {
                                  // Copy bypass
                                  if (typeof sourceEq.bypass === 'boolean') {
                                    actions.queueEqBypass(targetPanel.target, sourceEq.bypass)
                                  }
                                  // Copy points
                                  if (Array.isArray(sourceEq.point)) {
                                    for (const p of sourceEq.point) {
                                      actions.queueEqPoint(targetPanel.target, p)
                                    }
                                  }
                                }
                              }
                              actions.queueMic({ micEqJointDebugging: pressed })
                            }}
                            disabled={micDisabled}
                          >
                            {uiText('Mic EQ Link')}
                          </Toggle>
                        )}
                      </div>
                    ) : null
                  }
                  handleFilterChange={handleFilterChangeByKey[micKey]}
                  handlePointDoubleClick={handlePointDoubleClickByKey[micKey]}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => {
                    void actions.resetEq(panelByKey[micKey].target)
                    if (state.db?.db?.mic?.micEqJointDebugging) {
                      const otherKey = micKey === 'mica' ? 'micb' : 'mica'
                      void actions.resetEq(panelByKey[otherKey].target)
                    }
                  }}
                  onBypassChange={(pressed) => {
                    actions.queueEqBypass(panelByKey[micKey].target, pressed)
                    if (state.db?.db?.mic?.micEqJointDebugging) {
                      const otherKey = micKey === 'mica' ? 'micb' : 'mica'
                      actions.queueEqBypass(panelByKey[otherKey].target, pressed)
                    }
                  }}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showMicParamsCard && (
                    <ParameterCard className="md:col-span-2" contentClassName="sm:grid-cols-2 md:grid-cols-4">
                      {hasNumber(micDb?.micAVolume) && (
                        <NumberControl
                          label="Mic A Volume"
                          value={micDb?.micAVolume ?? undefined}
                          {...micRanges.micAVolume}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ micAVolume: Math.round(value) })}
                        />
                      )}
                      {hasNumber(micDb?.micBVolume) && (
                        <NumberControl
                          label="Mic B Volume"
                          value={micDb?.micBVolume ?? undefined}
                          {...micRanges.micBVolume}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ micBVolume: Math.round(value) })}
                        />
                      )}

                      {hasEnum(micDb?.micFBX, webhmi.FbxMode) && (
                        <div className="sm:col-span-2 md:col-span-4">
                          <ToggleGroupControl
                            label="Mic FBX"
                            value={micFbxValue}
                            options={micFbxOptions}
                            disabled={micDisabled}
                            onChange={(value) => {
                              const parsed = Number(value)
                              if (!Number.isNaN(parsed)) actions.queueMic({ micFBX: parsed as webhmi.FbxMode })
                            }}
                          />
                        </div>
                      )}
                      {hasNumber(micDb?.bass) && (
                        <NumberControl
                          label="Bass"
                          value={micDb?.bass ?? undefined}
                          {...micRanges.bass}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ bass: value })}
                        />
                      )}
                      {hasNumber(micDb?.mid) && (
                        <NumberControl
                          label="Mid"
                          value={micDb?.mid ?? undefined}
                          {...micRanges.mid}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ mid: value })}
                        />
                      )}
                      {hasNumber(micDb?.midFreq) && (
                        <NumberControl
                          label="Mid Freq (Hz)"
                          value={micDb?.midFreq ?? undefined}
                          {...micRanges.midFreq}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ midFreq: value })}
                        />
                      )}
                      {hasNumber(micDb?.treble) && (
                        <NumberControl
                          label="Treble"
                          value={micDb?.treble ?? undefined}
                          {...micRanges.treble}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ treble: value })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showMicNoiseCard && (
                    <ParameterCard title="Noise Gate" contentClassName="sm:grid-cols-2">
                      {hasNumber(micDb?.noise?.gate) && (
                        <NumberControl
                          label="Gate"
                          value={micDb?.noise?.gate ?? undefined}
                          {...micRanges.noise.gate}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ noise: { gate: value } })}
                        />
                      )}
                      {hasNumber(micDb?.noise?.frameTime) && (
                        <NumberControl
                          label="Frame Time"
                          value={micDb?.noise?.frameTime ?? undefined}
                          {...micRanges.noise.frameTime}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ noise: { frameTime: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(micDb?.noise?.atkTime) && (
                        <NumberControl
                          label="Attack Time"
                          value={micDb?.noise?.atkTime ?? undefined}
                          {...micRanges.noise.atkTime}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ noise: { atkTime: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(micDb?.noise?.relTime) && (
                        <NumberControl
                          label="Release Time"
                          value={micDb?.noise?.relTime ?? undefined}
                          {...micRanges.noise.relTime}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ noise: { relTime: Math.round(value) } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showMicCompressorCard && (
                    <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
                      {hasAny(micDb?.compressor?.threshold, micDb?.compressor?.ratio, micDb?.compressor?.attack, micDb?.compressor?.release) && (
                        <div className="sm:col-span-2">
                          <CompressorGraph
                            threshold={micDb?.compressor?.threshold}
                            ratio={micDb?.compressor?.ratio}
                            attack={micDb?.compressor?.attack}
                            release={micDb?.compressor?.release}
                            thresholdRange={micRanges.compressor.threshold}
                            disabled={micDisabled}
                          />
                        </div>
                      )}
                      {hasNumber(micDb?.compressor?.threshold) && (
                        <NumberControl
                          label="Threshold"
                          value={micDb?.compressor?.threshold ?? undefined}
                          {...micRanges.compressor.threshold}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ compressor: { threshold: value } })}
                        />
                      )}
                      {hasNumber(micDb?.compressor?.ratio) && (
                        <NumberControl
                          label="Ratio"
                          value={micDb?.compressor?.ratio ?? undefined}
                          {...micRanges.compressor.ratio}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ compressor: { ratio: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(micDb?.compressor?.attack) && (
                        <NumberControl
                          label="Attack"
                          value={micDb?.compressor?.attack ?? undefined}
                          {...micRanges.compressor.attack}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ compressor: { attack: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(micDb?.compressor?.release) && (
                        <NumberControl
                          label="Release"
                          value={micDb?.compressor?.release ?? undefined}
                          {...micRanges.compressor.release}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ compressor: { release: Math.round(value) } })}
                        />
                      )}
                      {hasBoolean(micDb?.compressor?.bypass) && (
                        <ToggleControl
                          label="Bypass"
                          pressed={micDb?.compressor?.bypass}
                          disabled={micDisabled}
                          onChange={(pressed) => actions.queueMic({ compressor: { bypass: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {reverbDb && (
            <TabsContent value="reverb">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('reverb')}
                  eqRange={reverbRanges.eq}
                  filters={panelStateByKey.reverb.filters}
                  allowedTypesByUiIndex={panelStateByKey.reverb.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.reverb.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  handleFilterChange={handleFilterChangeByKey.reverb}
                  handlePointDoubleClick={handlePointDoubleClickByKey.reverb}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.REVERB)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.REVERB, pressed)}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  {showReverbCard && (
                    <ParameterCard title="Reverb" className="md:col-span-2" contentClassName="sm:grid-cols-2">
                      {hasNumber(reverbDb?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={reverbDb?.reverbLevel ?? undefined}
                          {...reverbRanges.reverbLevel}
                          disabled={reverbDisabled}
                          onChange={(value) => actions.queueReverb({ reverbLevel: Math.round(value) })}
                          extra={
                            hasBoolean(reverbDb?.reverbLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={reverbDb?.reverbLevelPhaseInversion}
                                disabled={reverbDisabled}
                                onChange={(pressed) => actions.queueReverb({ reverbLevelPhaseInversion: pressed })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(reverbDb?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={reverbDb?.micDirectLevel ?? undefined}
                          {...reverbRanges.micDirectLevel}
                          disabled={reverbDisabled}
                          onChange={(value) => actions.queueReverb({ micDirectLevel: Math.round(value) })}
                          extra={
                            hasBoolean(reverbDb?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={reverbDb?.micDirectLevelPhaseInversion}
                                disabled={reverbDisabled}
                                onChange={(pressed) => actions.queueReverb({ micDirectLevelPhaseInversion: pressed })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(reverbDb?.reverbPredelay) && (
                        <NumberControl
                          label="Pre-delay"
                          value={reverbDb?.reverbPredelay ?? undefined}
                          {...reverbRanges.reverbPredelay}
                          disabled={reverbDisabled}
                          onChange={(value) => actions.queueReverb({ reverbPredelay: Math.round(value) })}
                        />
                      )}
                      {hasNumber(reverbDb?.reverbDecay) && (
                        <NumberControl
                          label="Decay"
                          value={reverbDb?.reverbDecay ?? undefined}
                          {...reverbRanges.reverbDecay}
                          disabled={reverbDisabled}
                          onChange={(value) => actions.queueReverb({ reverbDecay: Math.round(value) })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {echoDb && (
            <TabsContent value="echo">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('echo')}
                  eqRange={echoRanges.eq}
                  filters={panelStateByKey.echo.filters}
                  allowedTypesByUiIndex={panelStateByKey.echo.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.echo.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  handleFilterChange={handleFilterChangeByKey.echo}
                  handlePointDoubleClick={handlePointDoubleClickByKey.echo}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.ECHO)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.ECHO, pressed)}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  {showEchoCard && (
                    <ParameterCard title="Echo" className="md:col-span-2" contentClassName="sm:grid-cols-2 lg:grid-cols-3">
                      {hasNumber(echoDb?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={echoDb?.echoLevel ?? undefined}
                          {...echoRanges.echoLevel}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoLevel: Math.round(value) })}
                          extra={
                            hasBoolean(echoDb?.echoLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={echoDb?.echoLevelPhaseInversion}
                                disabled={echoDisabled}
                                onChange={(pressed) => actions.queueEcho({ echoLevelPhaseInversion: pressed })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(echoDb?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={echoDb?.micDirectLevel ?? undefined}
                          {...echoRanges.micDirectLevel}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ micDirectLevel: Math.round(value) })}
                          extra={
                            hasBoolean(echoDb?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={echoDb?.micDirectLevelPhaseInversion}
                                disabled={echoDisabled}
                                onChange={(pressed) => actions.queueEcho({ micDirectLevelPhaseInversion: pressed })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(echoDb?.echoPredelay) && (
                        <NumberControl
                          label="Pre-delay"
                          value={echoDb?.echoPredelay ?? undefined}
                          {...echoRanges.echoPredelay}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoPredelay: Math.round(value) })}
                        />
                      )}
                      {hasNumber(echoDb?.echoDelayTime) && (
                        <NumberControl
                          label="Delay Time"
                          value={echoDb?.echoDelayTime ?? undefined}
                          {...echoRanges.echoDelayTime}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoDelayTime: Math.round(value) })}
                        />
                      )}
                      {hasNumber(echoDb?.echoRepeat) && (
                        <NumberControl
                          label="Repeat"
                          value={echoDb?.echoRepeat ?? undefined}
                          {...echoRanges.echoRepeat}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoRepeat: Math.round(value) })}
                        />
                      )}
                      {hasNumber(echoDb?.echoRightPredelay) && (
                        <NumberControl
                          label="Right Pre-delay"
                          value={echoDb?.echoRightPredelay ?? undefined}
                          {...echoRanges.echoRightPredelay}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoRightPredelay: Math.round(value) })}
                        />
                      )}
                      {hasNumber(echoDb?.echoRightDelay) && (
                        <NumberControl
                          label="Right Delay"
                          value={echoDb?.echoRightDelay ?? undefined}
                          {...echoRanges.echoRightDelay}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoRightDelay: Math.round(value) })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {mainOutputDb && (
            <TabsContent value="mainoutput">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('mainoutput')}
                  eqRange={mainOutputRanges.eq}
                  filters={panelStateByKey.mainoutput.filters}
                  allowedTypesByUiIndex={panelStateByKey.mainoutput.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.mainoutput.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  disabled={mainOutputEqDisabled}
                  handleFilterChange={handleFilterChangeByKey.mainoutput}
                  handlePointDoubleClick={handlePointDoubleClickByKey.mainoutput}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  headerExtra={outputModeControls}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.MAIN_OUTPUT, undefined, resolvedOutputSceneMode)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.MAIN_OUTPUT, pressed, resolvedOutputSceneMode)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showMainOutputOutputCard && (
                    <ParameterCard title="Output" contentClassName="sm:grid-cols-2">
                      {hasNumber(mainOutputDb?.output?.leftChannelVolume) && (
                        <NumberControl
                          label="Left Volume"
                          value={mainOutputDb?.output?.leftChannelVolume ?? undefined}
                          {...mainOutputRanges.output.leftChannelVolume}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ output: { leftChannelVolume: value } })}
                          extra={
                            hasBoolean(mainOutputDb?.output?.leftChannelVolumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputDb?.output?.leftChannelVolumePhaseInversion}
                                disabled={mainOutputDisabled}
                                onChange={(pressed) => actions.queueMainOutput({ output: { leftChannelVolumePhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(mainOutputDb?.output?.rightChannelVolume) && (
                        <NumberControl
                          label="Right Volume"
                          value={mainOutputDb?.output?.rightChannelVolume ?? undefined}
                          {...mainOutputRanges.output.rightChannelVolume}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ output: { rightChannelVolume: value } })}
                          extra={
                            hasBoolean(mainOutputDb?.output?.rightChannelVolumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputDb?.output?.rightChannelVolumePhaseInversion}
                                disabled={mainOutputDisabled}
                                onChange={(pressed) => actions.queueMainOutput({ output: { rightChannelVolumePhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(mainOutputDb?.output?.leftDelay) && (
                        <NumberControl
                          label="Left Delay"
                          value={mainOutputDb?.output?.leftDelay ?? undefined}
                          {...mainOutputRanges.output.leftDelay}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ output: { leftDelay: value } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.output?.rightDelay) && (
                        <NumberControl
                          label="Right Delay"
                          value={mainOutputDb?.output?.rightDelay ?? undefined}
                          {...mainOutputRanges.output.rightDelay}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ output: { rightDelay: value } })}
                        />
                      )}
                      {hasBoolean(mainOutputDb?.output?.leftMute) && (
                        <ToggleControl
                          label="Left Mute"
                          pressed={mainOutputDb?.output?.leftMute}
                          disabled={mainOutputDisabled}
                          onChange={(pressed) => actions.queueMainOutput({ output: { leftMute: pressed } })}
                        />
                      )}
                      {hasBoolean(mainOutputDb?.output?.rightMute) && (
                        <ToggleControl
                          label="Right Mute"
                          pressed={mainOutputDb?.output?.rightMute}
                          disabled={mainOutputDisabled}
                          onChange={(pressed) => actions.queueMainOutput({ output: { rightMute: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showMainOutputMixerCard && (
                    <ParameterCard title="Mixer" contentClassName="sm:grid-cols-2">
                      {hasNumber(mainOutputMixer?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={mainOutputMixer?.micDirectLevel ?? undefined}
                          {...mainOutputRanges.mixer.micDirectLevel}
                          disabled={mainOutputMixerDisabled}
                          onChange={(value) => actions.queueMainOutput(mixerPatchForScene(resolvedOutputSceneMode, { micDirectLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(mainOutputMixer?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputMixer?.micDirectLevelPhaseInversion}
                                disabled={mainOutputMixerDisabled}
                                onChange={(pressed) => actions.queueMainOutput(mixerPatchForScene(resolvedOutputSceneMode, { micDirectLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(mainOutputMixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={mainOutputMixer?.musicLevel ?? undefined}
                          {...mainOutputRanges.mixer.musicLevel}
                          disabled={mainOutputMixerDisabled}
                          onChange={(value) => actions.queueMainOutput(mixerPatchForScene(resolvedOutputSceneMode, { musicLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(mainOutputMixer?.musicLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputMixer?.musicLevelPhaseInversion}
                                disabled={mainOutputMixerDisabled}
                                onChange={(pressed) => actions.queueMainOutput(mixerPatchForScene(resolvedOutputSceneMode, { musicLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(mainOutputMixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={mainOutputMixer?.reverbLevel ?? undefined}
                          {...mainOutputRanges.mixer.reverbLevel}
                          disabled={mainOutputMixerDisabled}
                          onChange={(value) => actions.queueMainOutput(mixerPatchForScene(resolvedOutputSceneMode, { reverbLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(mainOutputMixer?.reverbLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputMixer?.reverbLevelPhaseInversion}
                                disabled={mainOutputMixerDisabled}
                                onChange={(pressed) => actions.queueMainOutput(mixerPatchForScene(resolvedOutputSceneMode, { reverbLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(mainOutputMixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={mainOutputMixer?.echoLevel ?? undefined}
                          {...mainOutputRanges.mixer.echoLevel}
                          disabled={mainOutputMixerDisabled}
                          onChange={(value) => actions.queueMainOutput(mixerPatchForScene(resolvedOutputSceneMode, { echoLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(mainOutputMixer?.echoLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputMixer?.echoLevelPhaseInversion}
                                disabled={mainOutputMixerDisabled}
                                onChange={(pressed) => actions.queueMainOutput(mixerPatchForScene(resolvedOutputSceneMode, { echoLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showMainOutputCompressorCard && (
                    <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
                      {hasAny(
                        mainOutputDb?.compressor?.threshold,
                        mainOutputDb?.compressor?.ratio,
                        mainOutputDb?.compressor?.attack,
                        mainOutputDb?.compressor?.release,
                      ) && (
                        <div className="sm:col-span-2">
                          <CompressorGraph
                            threshold={mainOutputDb?.compressor?.threshold}
                            ratio={mainOutputDb?.compressor?.ratio}
                            attack={mainOutputDb?.compressor?.attack}
                            release={mainOutputDb?.compressor?.release}
                            thresholdRange={mainOutputRanges.compressor.threshold}
                            disabled={mainOutputDisabled}
                          />
                        </div>
                      )}
                      {hasNumber(mainOutputDb?.compressor?.threshold) && (
                        <NumberControl
                          label="Threshold"
                          value={mainOutputDb?.compressor?.threshold ?? undefined}
                          {...mainOutputRanges.compressor.threshold}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ compressor: { threshold: value } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.compressor?.ratio) && (
                        <NumberControl
                          label="Ratio"
                          value={mainOutputDb?.compressor?.ratio ?? undefined}
                          {...mainOutputRanges.compressor.ratio}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ compressor: { ratio: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.compressor?.attack) && (
                        <NumberControl
                          label="Attack"
                          value={mainOutputDb?.compressor?.attack ?? undefined}
                          {...mainOutputRanges.compressor.attack}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ compressor: { attack: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.compressor?.release) && (
                        <NumberControl
                          label="Release"
                          value={mainOutputDb?.compressor?.release ?? undefined}
                          {...mainOutputRanges.compressor.release}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ compressor: { release: Math.round(value) } })}
                        />
                      )}
                      {hasBoolean(mainOutputDb?.compressor?.bypass) && (
                        <ToggleControl
                          label="Bypass"
                          pressed={mainOutputDb?.compressor?.bypass}
                          disabled={mainOutputDisabled}
                          onChange={(pressed) => actions.queueMainOutput({ compressor: { bypass: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {subOutputDb && (
            <TabsContent value="suboutput">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('suboutput')}
                  eqRange={subOutputRanges.eq}
                  filters={panelStateByKey.suboutput.filters}
                  allowedTypesByUiIndex={panelStateByKey.suboutput.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.suboutput.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  disabled={subOutputEqDisabled}
                  handleFilterChange={handleFilterChangeByKey.suboutput}
                  handlePointDoubleClick={handlePointDoubleClickByKey.suboutput}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  headerExtra={outputModeControls}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.SUB_OUTPUT, undefined, resolvedOutputSceneMode)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.SUB_OUTPUT, pressed, resolvedOutputSceneMode)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showSubOutputOutputCard && (
                    <ParameterCard title="Output" contentClassName="sm:grid-cols-2">
                      {hasNumber(subOutputDb?.output?.volume) && (
                        <NumberControl
                          label="Volume"
                          value={subOutputDb?.output?.volume ?? undefined}
                          {...subOutputRanges.output.volume}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ output: { volume: value } })}
                          extra={
                            hasBoolean(subOutputDb?.output?.volumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={subOutputDb?.output?.volumePhaseInversion}
                                disabled={subOutputDisabled}
                                onChange={(pressed) => actions.queueSubOutput({ output: { volumePhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(subOutputDb?.output?.delay) && (
                        <NumberControl
                          label="Delay"
                          value={subOutputDb?.output?.delay ?? undefined}
                          {...subOutputRanges.output.delay}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ output: { delay: value } })}
                        />
                      )}
                      {hasBoolean(subOutputDb?.output?.mute) && (
                        <ToggleControl
                          label="Mute"
                          pressed={subOutputDb?.output?.mute}
                          disabled={subOutputDisabled}
                          onChange={(pressed) => actions.queueSubOutput({ output: { mute: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showSubOutputMixerCard && (
                    <ParameterCard title="Mixer" contentClassName="sm:grid-cols-2">
                      {hasNumber(subOutputMixer?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={subOutputMixer?.micDirectLevel ?? undefined}
                          {...subOutputRanges.mixer.micDirectLevel}
                          disabled={subOutputMixerDisabled}
                          onChange={(value) => actions.queueSubOutput(mixerPatchForScene(resolvedOutputSceneMode, { micDirectLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(subOutputMixer?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={subOutputMixer?.micDirectLevelPhaseInversion}
                                disabled={subOutputMixerDisabled}
                                onChange={(pressed) => actions.queueSubOutput(mixerPatchForScene(resolvedOutputSceneMode, { micDirectLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(subOutputMixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={subOutputMixer?.musicLevel ?? undefined}
                          {...subOutputRanges.mixer.musicLevel}
                          disabled={subOutputMixerDisabled}
                          onChange={(value) => actions.queueSubOutput(mixerPatchForScene(resolvedOutputSceneMode, { musicLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(subOutputMixer?.musicLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={subOutputMixer?.musicLevelPhaseInversion}
                                disabled={subOutputMixerDisabled}
                                onChange={(pressed) => actions.queueSubOutput(mixerPatchForScene(resolvedOutputSceneMode, { musicLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(subOutputMixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={subOutputMixer?.reverbLevel ?? undefined}
                          {...subOutputRanges.mixer.reverbLevel}
                          disabled={subOutputMixerDisabled}
                          onChange={(value) => actions.queueSubOutput(mixerPatchForScene(resolvedOutputSceneMode, { reverbLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(subOutputMixer?.reverbLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={subOutputMixer?.reverbLevelPhaseInversion}
                                disabled={subOutputMixerDisabled}
                                onChange={(pressed) => actions.queueSubOutput(mixerPatchForScene(resolvedOutputSceneMode, { reverbLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(subOutputMixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={subOutputMixer?.echoLevel ?? undefined}
                          {...subOutputRanges.mixer.echoLevel}
                          disabled={subOutputMixerDisabled}
                          onChange={(value) => actions.queueSubOutput(mixerPatchForScene(resolvedOutputSceneMode, { echoLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(subOutputMixer?.echoLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={subOutputMixer?.echoLevelPhaseInversion}
                                disabled={subOutputMixerDisabled}
                                onChange={(pressed) => actions.queueSubOutput(mixerPatchForScene(resolvedOutputSceneMode, { echoLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showSubOutputCompressorCard && (
                    <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
                      {hasAny(
                        subOutputDb?.compressor?.threshold,
                        subOutputDb?.compressor?.ratio,
                        subOutputDb?.compressor?.attack,
                        subOutputDb?.compressor?.release,
                      ) && (
                        <div className="sm:col-span-2">
                          <CompressorGraph
                            threshold={subOutputDb?.compressor?.threshold}
                            ratio={subOutputDb?.compressor?.ratio}
                            attack={subOutputDb?.compressor?.attack}
                            release={subOutputDb?.compressor?.release}
                            thresholdRange={subOutputRanges.compressor.threshold}
                            disabled={subOutputDisabled}
                          />
                        </div>
                      )}
                      {hasNumber(subOutputDb?.compressor?.threshold) && (
                        <NumberControl
                          label="Threshold"
                          value={subOutputDb?.compressor?.threshold ?? undefined}
                          {...subOutputRanges.compressor.threshold}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ compressor: { threshold: value } })}
                        />
                      )}
                      {hasNumber(subOutputDb?.compressor?.ratio) && (
                        <NumberControl
                          label="Ratio"
                          value={subOutputDb?.compressor?.ratio ?? undefined}
                          {...subOutputRanges.compressor.ratio}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ compressor: { ratio: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(subOutputDb?.compressor?.attack) && (
                        <NumberControl
                          label="Attack"
                          value={subOutputDb?.compressor?.attack ?? undefined}
                          {...subOutputRanges.compressor.attack}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ compressor: { attack: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(subOutputDb?.compressor?.release) && (
                        <NumberControl
                          label="Release"
                          value={subOutputDb?.compressor?.release ?? undefined}
                          {...subOutputRanges.compressor.release}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ compressor: { release: Math.round(value) } })}
                        />
                      )}
                      {hasBoolean(subOutputDb?.compressor?.bypass) && (
                        <ToggleControl
                          label="Bypass"
                          pressed={subOutputDb?.compressor?.bypass}
                          disabled={subOutputDisabled}
                          onChange={(pressed) => actions.queueSubOutput({ compressor: { bypass: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {centerDb && (
            <TabsContent value="center">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('center')}
                  eqRange={centerRanges.eq}
                  filters={panelStateByKey.center.filters}
                  allowedTypesByUiIndex={panelStateByKey.center.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.center.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  disabled={centerEqDisabled}
                  handleFilterChange={handleFilterChangeByKey.center}
                  handlePointDoubleClick={handlePointDoubleClickByKey.center}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  headerExtra={outputModeControls}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.CENTER, undefined, resolvedOutputSceneMode)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.CENTER, pressed, resolvedOutputSceneMode)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showCenterOutputCard && (
                    <ParameterCard title="Output" contentClassName="sm:grid-cols-2">
                      {hasNumber(centerDb?.output?.volume) && (
                        <NumberControl
                          label="Volume"
                          value={centerDb?.output?.volume ?? undefined}
                          {...centerRanges.output.volume}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ output: { volume: value } })}
                          extra={
                            hasBoolean(centerDb?.output?.volumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={centerDb?.output?.volumePhaseInversion}
                                disabled={centerDisabled}
                                onChange={(pressed) => actions.queueCenter({ output: { volumePhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(centerDb?.output?.delay) && (
                        <NumberControl
                          label="Delay"
                          value={centerDb?.output?.delay ?? undefined}
                          {...centerRanges.output.delay}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ output: { delay: value } })}
                        />
                      )}
                      {hasBoolean(centerDb?.output?.mute) && (
                        <ToggleControl
                          label="Mute"
                          pressed={centerDb?.output?.mute}
                          disabled={centerDisabled}
                          onChange={(pressed) => actions.queueCenter({ output: { mute: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showCenterMixerCard && (
                    <ParameterCard title="Mixer" contentClassName="sm:grid-cols-2">
                      {hasNumber(centerMixer?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={centerMixer?.micDirectLevel ?? undefined}
                          {...centerRanges.mixer.micDirectLevel}
                          disabled={centerMixerDisabled}
                          onChange={(value) => actions.queueCenter(mixerPatchForScene(resolvedOutputSceneMode, { micDirectLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(centerMixer?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={centerMixer?.micDirectLevelPhaseInversion}
                                disabled={centerMixerDisabled}
                                onChange={(pressed) => actions.queueCenter(mixerPatchForScene(resolvedOutputSceneMode, { micDirectLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(centerMixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={centerMixer?.musicLevel ?? undefined}
                          {...centerRanges.mixer.musicLevel}
                          disabled={centerMixerDisabled}
                          onChange={(value) => actions.queueCenter(mixerPatchForScene(resolvedOutputSceneMode, { musicLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(centerMixer?.musicLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={centerMixer?.musicLevelPhaseInversion}
                                disabled={centerMixerDisabled}
                                onChange={(pressed) => actions.queueCenter(mixerPatchForScene(resolvedOutputSceneMode, { musicLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(centerMixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={centerMixer?.reverbLevel ?? undefined}
                          {...centerRanges.mixer.reverbLevel}
                          disabled={centerMixerDisabled}
                          onChange={(value) => actions.queueCenter(mixerPatchForScene(resolvedOutputSceneMode, { reverbLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(centerMixer?.reverbLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={centerMixer?.reverbLevelPhaseInversion}
                                disabled={centerMixerDisabled}
                                onChange={(pressed) => actions.queueCenter(mixerPatchForScene(resolvedOutputSceneMode, { reverbLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(centerMixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={centerMixer?.echoLevel ?? undefined}
                          {...centerRanges.mixer.echoLevel}
                          disabled={centerMixerDisabled}
                          onChange={(value) => actions.queueCenter(mixerPatchForScene(resolvedOutputSceneMode, { echoLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(centerMixer?.echoLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={centerMixer?.echoLevelPhaseInversion}
                                disabled={centerMixerDisabled}
                                onChange={(pressed) => actions.queueCenter(mixerPatchForScene(resolvedOutputSceneMode, { echoLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showCenterCompressorCard && (
                    <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
                      {hasAny(centerDb?.compressor?.threshold, centerDb?.compressor?.ratio, centerDb?.compressor?.attack, centerDb?.compressor?.release) && (
                        <div className="sm:col-span-2">
                          <CompressorGraph
                            threshold={centerDb?.compressor?.threshold}
                            ratio={centerDb?.compressor?.ratio}
                            attack={centerDb?.compressor?.attack}
                            release={centerDb?.compressor?.release}
                            thresholdRange={centerRanges.compressor.threshold}
                            disabled={centerDisabled}
                          />
                        </div>
                      )}
                      {hasNumber(centerDb?.compressor?.threshold) && (
                        <NumberControl
                          label="Threshold"
                          value={centerDb?.compressor?.threshold ?? undefined}
                          {...centerRanges.compressor.threshold}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ compressor: { threshold: value } })}
                        />
                      )}
                      {hasNumber(centerDb?.compressor?.ratio) && (
                        <NumberControl
                          label="Ratio"
                          value={centerDb?.compressor?.ratio ?? undefined}
                          {...centerRanges.compressor.ratio}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ compressor: { ratio: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(centerDb?.compressor?.attack) && (
                        <NumberControl
                          label="Attack"
                          value={centerDb?.compressor?.attack ?? undefined}
                          {...centerRanges.compressor.attack}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ compressor: { attack: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(centerDb?.compressor?.release) && (
                        <NumberControl
                          label="Release"
                          value={centerDb?.compressor?.release ?? undefined}
                          {...centerRanges.compressor.release}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ compressor: { release: Math.round(value) } })}
                        />
                      )}
                      {hasBoolean(centerDb?.compressor?.bypass) && (
                        <ToggleControl
                          label="Bypass"
                          pressed={centerDb?.compressor?.bypass}
                          disabled={centerDisabled}
                          onChange={(pressed) => actions.queueCenter({ compressor: { bypass: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {surroundDb && (
            <TabsContent value="surround">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('surround')}
                  eqRange={surroundRanges.eq}
                  filters={panelStateByKey.surround.filters}
                  allowedTypesByUiIndex={panelStateByKey.surround.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.surround.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  disabled={surroundEqDisabled}
                  handleFilterChange={handleFilterChangeByKey.surround}
                  handlePointDoubleClick={handlePointDoubleClickByKey.surround}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  headerExtra={outputModeControls}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.SURROUND, undefined, resolvedOutputSceneMode)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.SURROUND, pressed, resolvedOutputSceneMode)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showSurroundOutputCard && (
                    <ParameterCard title="Output" contentClassName="sm:grid-cols-2">
                      {hasNumber(surroundDb?.output?.leftChannelVolume) && (
                        <NumberControl
                          label="Left Volume"
                          value={surroundDb?.output?.leftChannelVolume ?? undefined}
                          {...surroundRanges.output.leftChannelVolume}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ output: { leftChannelVolume: value } })}
                          extra={
                            hasBoolean(surroundDb?.output?.leftChannelVolumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundDb?.output?.leftChannelVolumePhaseInversion}
                                disabled={surroundDisabled}
                                onChange={(pressed) => actions.queueSurround({ output: { leftChannelVolumePhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(surroundDb?.output?.rightChannelVolume) && (
                        <NumberControl
                          label="Right Volume"
                          value={surroundDb?.output?.rightChannelVolume ?? undefined}
                          {...surroundRanges.output.rightChannelVolume}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ output: { rightChannelVolume: value } })}
                          extra={
                            hasBoolean(surroundDb?.output?.rightChannelVolumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundDb?.output?.rightChannelVolumePhaseInversion}
                                disabled={surroundDisabled}
                                onChange={(pressed) => actions.queueSurround({ output: { rightChannelVolumePhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(surroundDb?.output?.leftDelay) && (
                        <NumberControl
                          label="Left Delay"
                          value={surroundDb?.output?.leftDelay ?? undefined}
                          {...surroundRanges.output.leftDelay}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ output: { leftDelay: value } })}
                        />
                      )}
                      {hasNumber(surroundDb?.output?.rightDelay) && (
                        <NumberControl
                          label="Right Delay"
                          value={surroundDb?.output?.rightDelay ?? undefined}
                          {...surroundRanges.output.rightDelay}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ output: { rightDelay: value } })}
                        />
                      )}
                      {hasBoolean(surroundDb?.output?.leftMute) && (
                        <ToggleControl
                          label="Left Mute"
                          pressed={surroundDb?.output?.leftMute}
                          disabled={surroundDisabled}
                          onChange={(pressed) => actions.queueSurround({ output: { leftMute: pressed } })}
                        />
                      )}
                      {hasBoolean(surroundDb?.output?.rightMute) && (
                        <ToggleControl
                          label="Right Mute"
                          pressed={surroundDb?.output?.rightMute}
                          disabled={surroundDisabled}
                          onChange={(pressed) => actions.queueSurround({ output: { rightMute: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showSurroundMixerCard && (
                    <ParameterCard title="Mixer" contentClassName="sm:grid-cols-2">
                      {hasNumber(surroundMixer?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={surroundMixer?.micDirectLevel ?? undefined}
                          {...surroundRanges.mixer.micDirectLevel}
                          disabled={surroundMixerDisabled}
                          onChange={(value) => actions.queueSurround(mixerPatchForScene(resolvedOutputSceneMode, { micDirectLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(surroundMixer?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundMixer?.micDirectLevelPhaseInversion}
                                disabled={surroundMixerDisabled}
                                onChange={(pressed) => actions.queueSurround(mixerPatchForScene(resolvedOutputSceneMode, { micDirectLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(surroundMixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={surroundMixer?.musicLevel ?? undefined}
                          {...surroundRanges.mixer.musicLevel}
                          disabled={surroundMixerDisabled}
                          onChange={(value) => actions.queueSurround(mixerPatchForScene(resolvedOutputSceneMode, { musicLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(surroundMixer?.musicLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundMixer?.musicLevelPhaseInversion}
                                disabled={surroundMixerDisabled}
                                onChange={(pressed) => actions.queueSurround(mixerPatchForScene(resolvedOutputSceneMode, { musicLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(surroundMixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={surroundMixer?.reverbLevel ?? undefined}
                          {...surroundRanges.mixer.reverbLevel}
                          disabled={surroundMixerDisabled}
                          onChange={(value) => actions.queueSurround(mixerPatchForScene(resolvedOutputSceneMode, { reverbLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(surroundMixer?.reverbLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundMixer?.reverbLevelPhaseInversion}
                                disabled={surroundMixerDisabled}
                                onChange={(pressed) => actions.queueSurround(mixerPatchForScene(resolvedOutputSceneMode, { reverbLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(surroundMixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={surroundMixer?.echoLevel ?? undefined}
                          {...surroundRanges.mixer.echoLevel}
                          disabled={surroundMixerDisabled}
                          onChange={(value) => actions.queueSurround(mixerPatchForScene(resolvedOutputSceneMode, { echoLevel: Math.round(value) }))}
                          extra={
                            hasBoolean(surroundMixer?.echoLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundMixer?.echoLevelPhaseInversion}
                                disabled={surroundMixerDisabled}
                                onChange={(pressed) => actions.queueSurround(mixerPatchForScene(resolvedOutputSceneMode, { echoLevelPhaseInversion: pressed }))}
                              />
                            )
                          }
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showSurroundCompressorCard && (
                    <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
                      {hasAny(
                        surroundDb?.compressor?.threshold,
                        surroundDb?.compressor?.ratio,
                        surroundDb?.compressor?.attack,
                        surroundDb?.compressor?.release,
                      ) && (
                        <div className="sm:col-span-2">
                          <CompressorGraph
                            threshold={surroundDb?.compressor?.threshold}
                            ratio={surroundDb?.compressor?.ratio}
                            attack={surroundDb?.compressor?.attack}
                            release={surroundDb?.compressor?.release}
                            thresholdRange={surroundRanges.compressor.threshold}
                            disabled={surroundDisabled}
                          />
                        </div>
                      )}
                      {hasNumber(surroundDb?.compressor?.threshold) && (
                        <NumberControl
                          label="Threshold"
                          value={surroundDb?.compressor?.threshold ?? undefined}
                          {...surroundRanges.compressor.threshold}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ compressor: { threshold: value } })}
                        />
                      )}
                      {hasNumber(surroundDb?.compressor?.ratio) && (
                        <NumberControl
                          label="Ratio"
                          value={surroundDb?.compressor?.ratio ?? undefined}
                          {...surroundRanges.compressor.ratio}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ compressor: { ratio: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(surroundDb?.compressor?.attack) && (
                        <NumberControl
                          label="Attack"
                          value={surroundDb?.compressor?.attack ?? undefined}
                          {...surroundRanges.compressor.attack}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ compressor: { attack: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(surroundDb?.compressor?.release) && (
                        <NumberControl
                          label="Release"
                          value={surroundDb?.compressor?.release ?? undefined}
                          {...surroundRanges.compressor.release}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ compressor: { release: Math.round(value) } })}
                        />
                      )}
                      {hasBoolean(surroundDb?.compressor?.bypass) && (
                        <ToggleControl
                          label="Bypass"
                          pressed={surroundDb?.compressor?.bypass}
                          disabled={surroundDisabled}
                          onChange={(pressed) => actions.queueSurround({ compressor: { bypass: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}

