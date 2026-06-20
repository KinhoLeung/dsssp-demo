import { getEnumNumberValue, hasAny, type MainTabKey } from './dspUtils'

import { webhmi } from '@/device/proto/generated/webhmi'

export const TUNING_TAB_ORDER: MainTabKey[] = [
  'music',
  'mic',
  'reverb',
  'echo',
  'mainoutput',
  'suboutput',
  'center',
  'surround',
  'system',
]

export const getAvailableTuningTabs = (db: webhmi.IDeviceDb | null | undefined): MainTabKey[] => {
  if (!db) return []

  const tabs: MainTabKey[] = []
  if (db.music) tabs.push('music')
  if (db.mic) tabs.push('mic')
  if (db.reverb) tabs.push('reverb')
  if (db.echo) tabs.push('echo')
  if (db.mainOutput) tabs.push('mainoutput')
  if (db.subOutput) tabs.push('suboutput')
  if (db.center) tabs.push('center')
  if (db.surround) tabs.push('surround')
  if (db.system) tabs.push('system')
  return tabs
}

export const getInitialTuningTab = (db: webhmi.IDeviceDb | null | undefined): MainTabKey =>
  getAvailableTuningTabs(db)[0] ?? 'music'

export const resolveOutputControlMode = (systemDb: webhmi.ISystemDb | null | undefined) => {
  const value = getEnumNumberValue(systemDb?.controlMode, webhmi.OutputControlMode)
  return !Number.isNaN(value)
    ? value as webhmi.OutputControlMode
    : webhmi.OutputControlMode.OUTPUT_CONTROL_AUTO
}

export const resolveOutputSceneMode = (systemDb: webhmi.ISystemDb | null | undefined) => {
  const value = getEnumNumberValue(systemDb?.sceneMode, webhmi.OutputSceneMode)
  return !Number.isNaN(value)
    ? value as webhmi.OutputSceneMode
    : webhmi.OutputSceneMode.OUTPUT_SCENE_SING
}

export const buildSystemVisibility = (systemDb: webhmi.ISystemDb | null | undefined) => ({
  showDanceModeCard: hasAny(systemDb?.micDetectionThreshold, systemDb?.micDetectionTime),
  showSystemDefaultsCard: hasAny(
    systemDb?.useDefaultVolume,
    systemDb?.musicDefaultVolume,
    systemDb?.micDefaultVolume,
    systemDb?.effectDefaultVolume,
  ),
  showSystemLimitsCard: hasAny(systemDb?.musicMaxVolume, systemDb?.micMaxVolume, systemDb?.effectMaxVolume),
})

export const buildTuningVisibility = (db: webhmi.IDeviceDb | null | undefined, authOk: boolean | null | undefined) => {
  const safeDb = db ?? null
  const systemDb = safeDb?.system ?? null
  const baseDisabled = !safeDb || authOk !== true
  const outputAutoMode = resolveOutputControlMode(systemDb) === webhmi.OutputControlMode.OUTPUT_CONTROL_AUTO

  const disabled = {
    system: baseDisabled || !safeDb?.system,
    music: baseDisabled || !safeDb?.music,
    mic: baseDisabled || !safeDb?.mic,
    reverb: baseDisabled || !safeDb?.reverb,
    echo: baseDisabled || !safeDb?.echo,
    mainOutput: baseDisabled || !safeDb?.mainOutput,
    subOutput: baseDisabled || !safeDb?.subOutput,
    center: baseDisabled || !safeDb?.center,
    surround: baseDisabled || !safeDb?.surround,
  }

  return {
    availableTabs: getAvailableTuningTabs(safeDb),
    baseDisabled,
    outputAutoMode,
    resolvedOutputControlMode: resolveOutputControlMode(systemDb),
    resolvedOutputSceneMode: resolveOutputSceneMode(systemDb),
    hasMicA: !!safeDb?.mic?.micAEq?.eq,
    hasMicB: !!safeDb?.mic?.micBEq?.eq,
    showMicSelector: !!safeDb?.mic?.micAEq?.eq && !!safeDb?.mic?.micBEq?.eq,
    ...buildSystemVisibility(systemDb),
    disabled: {
      ...disabled,
      mainOutputEq: disabled.mainOutput || outputAutoMode,
      subOutputEq: disabled.subOutput || outputAutoMode,
      centerEq: disabled.center || outputAutoMode,
      surroundEq: disabled.surround || outputAutoMode,
      mainOutputMixer: disabled.mainOutput || outputAutoMode,
      subOutputMixer: disabled.subOutput || outputAutoMode,
      centerMixer: disabled.center || outputAutoMode,
      surroundMixer: disabled.surround || outputAutoMode,
    },
  }
}